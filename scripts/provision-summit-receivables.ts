/**
 * One-time setup of the Summit Consulting receivables sheet, its two staff logins and its
 * October and November 2026 invoices. It is meant to be run once against production through a
 * tunnel, and it is safe to run again: every step first looks for what is already there.
 *
 *   npm run receivables:provision-summit -- [--dry-run] [--org "Summit Consulting"] \
 *     [--file scripts/data/summit-receivables-oct-nov-2026.json] [--usd-rate 95.25]
 *
 * What it does, in this order:
 *  1. Makes sure the manager (phanisaiteja.m@sbcllp.in) and the project lead (jeyansh@sbcllp.in)
 *     have a profile. A new profile gets a random temporary password, which is printed once at
 *     the end and written nowhere else. An existing profile is used as it is: its role and its
 *     password are never changed, and a role that differs from the expected one is only warned about.
 *  2. Makes sure a receivables sheet exists for the organisation, managed by the manager. An
 *     existing sheet is reused and its manager is left alone.
 *  3. Names the project lead as an extra editor of the sheet.
 *  4. Inserts the invoices from the JSON file as open invoices. An invoice whose number is already
 *     on the sheet (and not deleted) is skipped. One change row records the import.
 *
 * Nothing is published: the manager checks the sheet and clicks Update, and only then does the
 * client page show it. `--dry-run` reads the database, prints what a real run would do and writes
 * nothing.
 *
 * The repository functions for steps 2 and 3 use their own connection, so the steps cannot share
 * one transaction. They are ordered so that a second run finishes a run that stopped part-way;
 * the invoices and their change row are written in one transaction.
 *
 * The JSON file is an array of
 *   { invoiceNo, clientName, invoiceDate, dueDate, currency, amount, kind, description, review }
 * with dates as YYYY-MM-DD, currency "INR" or "USD", and amount the final invoice value. A USD
 * invoice is valued in rupees at `--usd-rate`. A non-null `review` is a note for the operator and
 * is listed in the printout; it is not stored.
 */
import './load-env';

import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../src/db/client';
import { profiles, receivableChanges, receivableInvoices, receivableSheetEditors, receivableSheets } from '../src/db/schema';
import { systemCreateSheet } from '../src/db/repositories/receivables';
import { systemAddSheetEditor } from '../src/db/repositories/receivables/sheets';

const DEFAULT_FILE = 'scripts/data/summit-receivables-oct-nov-2026.json';
const DEFAULT_USD_RATE = 95.25;
/** The same bcrypt cost as `createManagerProfile` and `createInternProfile`. */
const BCRYPT_COST = 10;

type StaffRole = 'manager' | 'intern';
type StaffSpec = { email: string; name: string; role: StaffRole; label: string };

const MANAGER: StaffSpec = { email: 'phanisaiteja.m@sbcllp.in', name: 'Phani Sai Teja M', role: 'manager', label: 'manager' };
const LEAD: StaffSpec = { email: 'jeyansh@sbcllp.in', name: 'Jeyansh', role: 'intern', label: 'project lead' };

type InvoiceIn = {
  invoiceNo: string;
  clientName: string;
  invoiceDate: string;
  dueDate: string;
  currency: 'INR' | 'USD';
  amount: number;
  kind?: string | null;
  description?: string | null;
  review?: string | null;
};

type InvoiceLine = InvoiceIn & { invoiceMonth: string; amountInr: number };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const round2 = (n: number) => Math.round(n * 100) / 100;
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Reads and checks the JSON file, and works out the month and the rupee value of each invoice. */
function readInvoices(path: string, usdRate: number): InvoiceLine[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(raw)) throw new Error(`${path} must hold a JSON array of invoices.`);
  const seen = new Set<string>();
  return raw.map((r: InvoiceIn, idx) => {
    const at = `${path} item ${idx + 1}`;
    const invoiceNo = typeof r?.invoiceNo === 'string' ? r.invoiceNo.trim() : '';
    const clientName = typeof r?.clientName === 'string' ? r.clientName.trim() : '';
    if (!invoiceNo) throw new Error(`${at}: invoiceNo is missing (it is the key that makes a re-run safe).`);
    if (seen.has(invoiceNo)) throw new Error(`${at}: invoiceNo ${invoiceNo} appears twice in the file.`);
    seen.add(invoiceNo);
    if (!clientName) throw new Error(`${at} (${invoiceNo}): clientName is missing.`);
    if (!isIsoDate(r.invoiceDate)) throw new Error(`${at} (${invoiceNo}): invoiceDate must be YYYY-MM-DD.`);
    if (!isIsoDate(r.dueDate)) throw new Error(`${at} (${invoiceNo}): dueDate must be YYYY-MM-DD.`);
    if (r.currency !== 'INR' && r.currency !== 'USD') throw new Error(`${at} (${invoiceNo}): currency must be INR or USD.`);
    if (typeof r.amount !== 'number' || !Number.isFinite(r.amount) || r.amount <= 0) throw new Error(`${at} (${invoiceNo}): amount must be a positive number.`);
    const amount = round2(r.amount);
    return {
      ...r,
      invoiceNo,
      clientName,
      amount,
      review: typeof r.review === 'string' && r.review.trim() ? r.review.trim() : null,
      invoiceMonth: `${r.invoiceDate.slice(0, 7)}-01`,
      amountInr: r.currency === 'USD' ? round2(amount * usdRate) : amount,
    };
  });
}

/** Sixteen URL-safe characters from 96 random bits. */
function temporaryPassword(): string {
  return randomBytes(12).toString('base64url');
}

/** The same shape as `generateInternId` in the profiles repository. */
function newInternId(): string {
  return `i${randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

type ProfileRow = { id: string; email: string; name: string | null; role: string; status: string; internId: string | null };

async function findProfile(email: string): Promise<ProfileRow | null> {
  const [row] = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name, role: profiles.role, status: profiles.status, internId: profiles.internId })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);
  return row ?? null;
}

function warnAboutExisting(spec: StaffSpec, row: ProfileRow): void {
  console.log(`  ${spec.label}: ${spec.email} already exists (role ${row.role}, status ${row.status}). Used as it is; role and password not changed.`);
  if (row.role !== spec.role) console.log(`  WARNING: ${spec.email} has the role "${row.role}", not the expected "${spec.role}". Nothing was changed; check that this person can open the sheet.`);
  if (row.status !== 'active') console.log(`  WARNING: ${spec.email} has the status "${row.status}" and cannot sign in until it is active.`);
  if (row.role === 'intern' && !row.internId?.trim()) console.log(`  WARNING: ${spec.email} is a project lead without an intern id, so sign-in is refused. Nothing was changed.`);
}

async function main() {
  const file = arg('file') ?? DEFAULT_FILE;
  const org = (arg('org') ?? 'Summit Consulting').trim();
  const usdRate = arg('usd-rate') ? Number(arg('usd-rate')) : DEFAULT_USD_RATE;
  const dryRun = has('dry-run');
  if (!org) throw new Error('--org must not be empty.');
  if (!Number.isFinite(usdRate) || usdRate <= 0) throw new Error('--usd-rate must be a positive number, for example 95.25.');

  const lines = readInvoices(file, usdRate);
  const created: Array<{ spec: StaffSpec; password: string }> = [];

  console.log(`${dryRun ? 'DRY RUN. ' : ''}Receivables setup for "${org}" from ${file} (USD at ${usdRate}).\n`);

  try {
    // 1. Profiles.
    console.log('Profiles');
    let manager = await findProfile(MANAGER.email);
    let lead = await findProfile(LEAD.email);

    if (manager) warnAboutExisting(MANAGER, manager);
    else if (dryRun) console.log(`  ${MANAGER.label}: would create ${MANAGER.email} ("${MANAGER.name}", role manager, status active) with a temporary password.`);
    else {
      const password = temporaryPassword();
      // The same columns `createManagerProfile` sets.
      const [row] = await db
        .insert(profiles)
        .values({ email: MANAGER.email, passwordHash: await bcrypt.hash(password, BCRYPT_COST), name: MANAGER.name, role: 'manager', status: 'active' })
        .returning({ id: profiles.id, email: profiles.email, name: profiles.name, role: profiles.role, status: profiles.status, internId: profiles.internId });
      manager = row;
      created.push({ spec: MANAGER, password });
      console.log(`  ${MANAGER.label}: created ${MANAGER.email} (${row.id}).`);
    }

    if (lead) warnAboutExisting(LEAD, lead);
    else if (dryRun) console.log(`  ${LEAD.label}: would create ${LEAD.email} ("${LEAD.name}", role intern, status active, a new intern id, reporting to the manager) with a temporary password.`);
    else {
      const password = temporaryPassword();
      // The same columns `createInternProfile` sets when a manager creates a lead: the lead
      // reports to that manager. An existing profile that is not a manager gets no report line.
      const [row] = await db
        .insert(profiles)
        .values({
          email: LEAD.email,
          passwordHash: await bcrypt.hash(password, BCRYPT_COST),
          name: LEAD.name,
          role: 'intern',
          phone: null,
          status: 'active',
          internId: newInternId(),
          reportsToManagerId: manager && manager.role === 'manager' ? manager.id : null,
        })
        .returning({ id: profiles.id, email: profiles.email, name: profiles.name, role: profiles.role, status: profiles.status, internId: profiles.internId });
      lead = row;
      created.push({ spec: LEAD, password });
      console.log(`  ${LEAD.label}: created ${LEAD.email} (${row.id}, intern id ${row.internId}).`);
    }

    // 2. Sheet.
    console.log('\nSheet');
    const [existingSheet] = await db
      .select({ id: receivableSheets.id, name: receivableSheets.name, managerUserId: receivableSheets.managerUserId, publishedVersionId: receivableSheets.publishedVersionId })
      .from(receivableSheets)
      .where(eq(receivableSheets.clientOrgName, org))
      .limit(1);
    let sheetId: string | null = existingSheet?.id ?? null;
    if (existingSheet) {
      let managedBy = 'nobody (manager is empty; left as it is, only firm-wide admins and editors can open it)';
      if (existingSheet.managerUserId) {
        const [m] = await db.select({ email: profiles.email, name: profiles.name }).from(profiles).where(eq(profiles.id, existingSheet.managerUserId)).limit(1);
        managedBy = m ? `${m.name?.trim() || m.email} <${m.email}>` : existingSheet.managerUserId;
      }
      console.log(`  A sheet for "${org}" already exists (${existingSheet.id}, name "${existingSheet.name}"). Reused.`);
      console.log(`  Managed by: ${managedBy}.`);
      if (manager && existingSheet.managerUserId !== manager.id) console.log(`  WARNING: the sheet is not managed by ${MANAGER.email}. Its manager was not changed.`);
    } else if (dryRun) {
      console.log(`  Would create a sheet with name and client organisation "${org}", managed by ${MANAGER.email}.`);
    } else {
      const sheet = await systemCreateSheet({ name: org, clientOrgName: org, managerUserId: manager!.id });
      sheetId = sheet.id;
      console.log(`  Created sheet ${sheet.id} for "${org}", managed by ${MANAGER.email}.`);
    }

    // 3. Extra editor.
    console.log('\nEditor');
    let alreadyEditor = false;
    if (sheetId && lead) {
      const [e] = await db
        .select({ userId: receivableSheetEditors.userId })
        .from(receivableSheetEditors)
        .where(and(eq(receivableSheetEditors.sheetId, sheetId), eq(receivableSheetEditors.userId, lead.id)))
        .limit(1);
      alreadyEditor = Boolean(e);
    }
    if (alreadyEditor) console.log(`  ${LEAD.email} is already an editor of the sheet.`);
    else if (dryRun) console.log(`  Would add ${LEAD.email} as an editor of the sheet.`);
    else {
      await systemAddSheetEditor({ sheetId: sheetId!, userId: lead!.id, addedBy: manager!.id });
      console.log(`  Added ${LEAD.email} as an editor of the sheet.`);
    }

    // 4. Invoices.
    const onSheet = new Set<string>();
    if (sheetId) {
      const rows = await db
        .select({ invoiceNo: receivableInvoices.invoiceNo })
        .from(receivableInvoices)
        .where(and(eq(receivableInvoices.sheetId, sheetId), isNull(receivableInvoices.deletedAt)));
      for (const r of rows) if (r.invoiceNo?.trim()) onSheet.add(r.invoiceNo.trim());
    }
    const fresh = lines.filter((l) => !onSheet.has(l.invoiceNo));

    console.log(`\nInvoices (${lines.length} in the file)`);
    for (const l of lines) {
      const state = onSheet.has(l.invoiceNo) ? 'already there' : dryRun ? 'would insert' : 'insert';
      const value = l.currency === 'USD' ? `${usd(l.amount).padStart(14)} = ${inr(l.amountInr).padStart(18)}` : `${''.padStart(14)}   ${inr(l.amountInr).padStart(18)}`;
      console.log(`  ${l.invoiceNo.padEnd(16)} ${l.invoiceDate} due ${l.dueDate}  ${l.clientName.slice(0, 28).padEnd(28)} ${l.currency} ${value}  ${(l.kind ?? '').padEnd(10)} [${state}]${l.review ? '  REVIEW' : ''}`);
    }

    const total = (rows: InvoiceLine[]) => ({
      inrCount: rows.filter((l) => l.currency === 'INR').length,
      inrSum: round2(rows.filter((l) => l.currency === 'INR').reduce((a, l) => a + l.amount, 0)),
      usdCount: rows.filter((l) => l.currency === 'USD').length,
      usdSum: round2(rows.filter((l) => l.currency === 'USD').reduce((a, l) => a + l.amount, 0)),
      usdInInr: round2(rows.filter((l) => l.currency === 'USD').reduce((a, l) => a + l.amountInr, 0)),
      all: round2(rows.reduce((a, l) => a + l.amountInr, 0)),
    });
    const printTotals = (title: string, rows: InvoiceLine[]) => {
      const t = total(rows);
      console.log(`  ${title}: ${rows.length} invoices`);
      console.log(`    INR invoices: ${t.inrCount}, ${inr(t.inrSum)}`);
      console.log(`    USD invoices: ${t.usdCount}, ${usd(t.usdSum)} = ${inr(t.usdInInr)} at ${usdRate}`);
      console.log(`    All in rupees: ${inr(t.all)}`);
    };
    console.log('\nTotals');
    printTotals('In the file', lines);
    printTotals(dryRun ? 'Would be inserted' : 'To insert', fresh);

    const toReview = lines.filter((l) => l.review);
    console.log(`\nRows to review (${toReview.length})`);
    for (const l of toReview) console.log(`  ${l.invoiceNo.padEnd(16)} ${l.clientName}: ${l.review}`);
    if (!toReview.length) console.log('  None.');

    if (dryRun) {
      console.log('\nDry run: nothing written.');
      return;
    }

    if (fresh.length) {
      const fileName = file.split('/').pop();
      await db.transaction(async (tx) => {
        await tx.insert(receivableInvoices).values(
          fresh.map((l) => ({
            sheetId: sheetId!,
            invoiceMonth: l.invoiceMonth,
            invoiceDate: l.invoiceDate,
            clientName: l.clientName,
            invoiceNo: l.invoiceNo,
            partnerId: null,
            dueDate: l.dueDate,
            amountInr: l.amountInr.toFixed(2),
            currency: l.currency,
            fcAmount: l.currency === 'USD' ? l.amount.toFixed(2) : null,
            fxRate: l.currency === 'USD' ? usdRate.toFixed(6) : null,
            status: 'open',
            createdBy: manager!.id,
          })),
        );
        await tx.insert(receivableChanges).values({ sheetId: sheetId!, invoiceId: null, actorId: manager!.id, summary: `${fresh.length} invoices imported from ${fileName}` });
      });
    }

    const site = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
    console.log('\nDone');
    console.log(`  Profiles: ${created.length} created, ${2 - created.length} already there.`);
    console.log(`  Sheet ${sheetId}: ${existingSheet ? 'already there' : 'created'}.`);
    console.log(`  Editor ${LEAD.email}: ${alreadyEditor ? 'already there' : 'added'}.`);
    console.log(`  Invoices: ${fresh.length} inserted, ${lines.length - fresh.length} already there.`);
    console.log(`  Nothing is published. The manager checks the sheet at ${site}/receivables/manager and clicks Update.`);
  } finally {
    // Printed even when a later step failed, because a re-run finds the profile and cannot show
    // the password again.
    if (created.length) {
      console.log('\n==================== TEMPORARY PASSWORDS (shown once) ====================');
      for (const c of created) console.log(`  ${c.spec.label.padEnd(13)} ${c.spec.email.padEnd(28)} ${c.password}`);
      console.log('  These are stored only as bcrypt hashes and cannot be shown again.');
      console.log('  Hand each one over privately. The person signs in with it and then changes');
      console.log('  it under Account settings (current password, then the new one, at least 8');
      console.log('  characters). The "Forgot your password?" link on the sign-in page does not');
      console.log('  send an email for staff yet; it only says to ask the firm manager.');
      console.log('==========================================================================');
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
