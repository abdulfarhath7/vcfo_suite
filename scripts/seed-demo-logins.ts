/**
 * Shared demo logins on the real application (docs/context/notes/demo-data.md, "Demo logins").
 *
 *   npm run db:seed-demo-logins              # local: the demo database next to .env.local's
 *   npm run db:seed-demo-logins:prod         # production RDS, through the SSM tunnel
 *   npm run db:seed-demo-logins -- --reset   # also drop everything visitors added on the demo companies
 *
 * PLAN H2: the demo world is its own database (DEMO_DB_NAME, default `vcfo_demo`) on the same
 * Postgres server, never the main one. The script creates that database when it is missing,
 * applies every migration to it, and then writes everything inside `runInDemo`, so each query
 * goes to the demo database (src/db/demo-scope.ts). Placeholder files go under the `demo/`
 * storage prefix for the same reason.
 *
 * Logins (the password is DEMO_LOGIN_PASSWORD, or the default in this file):
 *   admin@vcfosuite.com    Firm admin of the demo firm
 *   manager@vcfosuite.com  Project manager of the three demo companies, owner of the receivables sheet
 *   lead@vcfosuite.com     Project lead on the three demo companies
 *   client@vcfosuite.com   Client portal of Kaveri Analytics
 *
 * State of each company: incorporation fully done (all 14 steps, the certificate, PAN, TAN, board
 * resolutions and the post-incorporation steps); registrations half done (GST with a GSTIN, LUT
 * and MSME done; PF and PT in progress; ESI and Shops & Establishment not started), except
 * Narmada Cloudworks, whose GST registration is ready to start for the VCFO Assist demo; the
 * FY 2026-27 compliance calendar filed up to the end of last month, this month's past due dates
 * overdue and the rest upcoming. Plus tasks, documents, a receivables sheet and a budget.
 *
 * SAFETY
 *   - It only ever writes to the demo database, and refuses when DEMO_DB_NAME names the main one.
 *   - Every row it writes is flagged `is_demo` (profiles, engagements) or hangs off one, which the
 *     sign-in and the guard check as a second fence.
 *   - Rerunning is safe. Seeded rows on the demo companies (documents, tasks, filings, GST fields,
 *     activity, the budget) are rebuilt; ids of the people and companies are kept. `--reset`
 *     deletes and recreates the demo companies, which also drops whatever visitors added.
 *   - Compliance filings come from the pure generator for these engagements only.
 *   - Identifiers are fake: PANs and TANs use the unallotted `ZZ` series, CINs a `9999xx`
 *     registration number, and GSTINs are built from those PANs with a valid check digit.
 */
import './load-env';

import bcrypt from 'bcryptjs';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/client';
import {
  activity,
  auditEvents,
  budgets,
  complianceInstances,
  complianceObligations,
  complianceSubjectFields,
  documents,
  engagementClients,
  engagementLeads,
  engagementManagers,
  engagements,
  profiles,
  receivableInvoices,
  receivablePartners,
  receivableSheets,
  tasks,
} from '../src/db/schema';
import type { AuthContext } from '../src/auth/guards';
import { getActiveCatalogItems } from '../src/data/checklist';
import { COMPLIANCE_OBLIGATIONS } from '../src/lib/compliance/obligations-seed';
import { generateComplianceInstances } from '../src/lib/compliance/generate-instances';
import type { ChecklistItemStateSlice } from '../src/lib/checklist/checklist-state-key';
import { DEMO_EMAIL_DOMAIN } from '../src/lib/demo-logins';
import { createBudget } from '../src/db/repositories/budgets';
import { publishSheet, systemAddSheetEditor, systemCreateSheet } from '../src/db/repositories/receivables';
import { documentStorageKey, seedPlaceholders } from '../src/storage/demo-placeholders';
import { firmSettings } from '../src/db/schema-firm';
import { runInDemo } from '../src/db/demo-scope';
import { describeTarget, ensureDemoDatabase, migrateDemoDatabase, requireDemoDbName } from './demo-db';

const PASSWORD = process.env.DEMO_LOGIN_PASSWORD?.trim() || 'Demo@2026';
const SLUG_PREFIX = 'vcfodemo-';
const STORAGE_PREFIX = 'vcfodemo/';
const LEAD_INTERN_ID = 'demo-lead';

const CATALOG = getActiveCatalogItems();
const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => ymd(new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY));
const email = (local: string) => `${local}@${DEMO_EMAIL_DOMAIN}`;

/* ------------------------------------------------------------------ *
 * Fake identifiers
 * ------------------------------------------------------------------ */

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The GSTIN check character (the published mod-36 scheme), so validators accept the number. */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const p = GSTIN_CHARS.indexOf(first14[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36]!;
}
const gstinFor = (stateCode: string, pan: string) => {
  const body = `${stateCode}${pan}1Z`;
  return body + gstinCheckChar(body);
};

/* ------------------------------------------------------------------ *
 * People
 * ------------------------------------------------------------------ */

type Person = {
  key: string;
  email: string;
  name: string;
  role: 'admin' | 'intern' | 'client' | 'manager';
  designation: string;
  login: boolean;
  internId?: string;
  clientId?: string;
};

const PEOPLE: Person[] = [
  { key: 'admin', email: email('admin'), name: 'Nandini Rao', role: 'admin', designation: 'Firm Admin', login: true },
  { key: 'manager', email: email('manager'), name: 'Kavya Menon', role: 'manager', designation: 'Project Manager', login: true },
  { key: 'lead', email: email('lead'), name: 'Arjun Rao', role: 'intern', designation: 'Project Lead', login: true, internId: LEAD_INTERN_ID },
  { key: 'client', email: email('client'), name: 'Meera Iyer', role: 'client', designation: 'Finance Director, Kaveri Analytics', login: true, clientId: 'demo-client-kaveri' },
  // Client contacts of the other two companies: records only, inactive, no password.
  { key: 'client-tunga', email: email('tungabhadra'), name: 'Rohan Kulkarni', role: 'client', designation: 'Director, Tungabhadra Foods', login: false, clientId: 'demo-client-tungabhadra' },
  { key: 'client-narmada', email: email('narmada'), name: 'Sarah Whitfield', role: 'client', designation: 'CFO, Narmada Cloudworks Inc.', login: false, clientId: 'demo-client-narmada' },
];

/* ------------------------------------------------------------------ *
 * Companies
 * ------------------------------------------------------------------ */

type Company = {
  slug: string;
  name: string;
  clientKey: string;
  clientName: string;
  companyType: 'domestic' | 'foreign';
  parentName: string;
  parentAddress: string;
  address: string;
  state: string;
  stateCode: string;
  incorporated: string;
  cin: string;
  pan: string;
  tan: string;
  gstDone: boolean;
  employees: number;
  health: 'on-track' | 'at-risk';
  directors: Array<{ first: string; last: string; gender: 'male' | 'female'; resident: boolean; din: string; pan: string }>;
};

const COMPANIES: Company[] = [
  {
    slug: `${SLUG_PREFIX}kaveri-analytics`,
    name: 'Kaveri Analytics Pvt Ltd',
    clientKey: 'client',
    clientName: 'Kaveri Analytics',
    companyType: 'domestic',
    parentName: 'Kaveri Holdings LLP',
    parentAddress: '14, 2nd Cross, Indiranagar, Bengaluru 560038',
    address: '3rd Floor, 81 Residency Road, Shanthala Nagar, Bengaluru, Karnataka 560025',
    state: 'Karnataka',
    stateCode: '29',
    incorporated: '2025-09-18',
    cin: 'U62099KA2025PTC999101',
    pan: 'ZZACK9101K',
    tan: 'BLRZ99101K',
    gstDone: true,
    employees: 24,
    health: 'on-track',
    directors: [
      { first: 'Meera', last: 'Iyer', gender: 'female', resident: true, din: '99910101', pan: 'ZZAPI9101M' },
      { first: 'Vikram', last: 'Hegde', gender: 'male', resident: true, din: '99910102', pan: 'ZZAPH9102V' },
    ],
  },
  {
    slug: `${SLUG_PREFIX}tungabhadra-foods`,
    name: 'Tungabhadra Foods Pvt Ltd',
    clientKey: 'client-tunga',
    clientName: 'Tungabhadra Foods',
    companyType: 'domestic',
    parentName: 'Tungabhadra Agro Industries Ltd',
    parentAddress: 'Plot 22, Industrial Area, Hosapete 583201',
    address: 'Unit 5, 6-3-1109 Raj Bhavan Road, Somajiguda, Hyderabad, Telangana 500082',
    state: 'Telangana',
    stateCode: '36',
    incorporated: '2025-12-03',
    cin: 'U10790TG2025PTC999102',
    pan: 'ZZACT9102F',
    tan: 'HYDZ99102T',
    gstDone: true,
    employees: 41,
    health: 'at-risk',
    directors: [
      { first: 'Rohan', last: 'Kulkarni', gender: 'male', resident: true, din: '99910201', pan: 'ZZAPK9201R' },
      { first: 'Lakshmi', last: 'Reddy', gender: 'female', resident: true, din: '99910202', pan: 'ZZAPR9202L' },
    ],
  },
  {
    slug: `${SLUG_PREFIX}narmada-cloudworks`,
    name: 'Narmada Cloudworks India Pvt Ltd',
    clientKey: 'client-narmada',
    clientName: 'Narmada Cloudworks Inc.',
    companyType: 'foreign',
    parentName: 'Narmada Cloudworks Inc.',
    parentAddress: '500 Market Street, Suite 300, San Francisco, CA 94105, USA',
    address: 'Office 702, Panchshil Tech Park, Yerwada, Pune, Maharashtra 411006',
    state: 'Maharashtra',
    stateCode: '27',
    incorporated: '2026-02-10',
    cin: 'U62013MH2026FTC999103',
    pan: 'ZZACN9103C',
    tan: 'PNEZ99103N',
    gstDone: false,
    employees: 9,
    health: 'on-track',
    directors: [
      { first: 'Sarah', last: 'Whitfield', gender: 'female', resident: false, din: '99910301', pan: '' },
      { first: 'Nikhil', last: 'Deshmukh', gender: 'male', resident: true, din: '99910302', pan: 'ZZAPD9302N' },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Checklist state
 * ------------------------------------------------------------------ */

/** Registrations: done, in progress, not started, or not applicable to these companies. */
const REG_DONE_WITH_GST = ['reg-4', 'reg-5', 'reg-15'];
const REG_IN_PROGRESS = ['reg-1', 'reg-7'];
const REG_NOT_APPLICABLE = ['reg-17', 'reg-18', 'reg-19', 'reg-22', 'reg-24'];
const NA_NOTE = 'Not applicable to this company.';

function checklistFor(c: Company): Record<string, ChecklistItemStateSlice> {
  const state: Record<string, ChecklistItemStateSlice> = {};
  const incorporation = CATALOG.filter((i) => i.id.startsWith('pre-') || i.id.startsWith('post-'));
  // Spread the incorporation steps over the 60 days before the certificate and the 45 after.
  incorporation.forEach((item, i) => {
    const pre = item.id.startsWith('pre-');
    const offset = pre ? -60 + Math.round((60 * i) / 14) : 3 + (i - 14) * 3;
    const completedOn = addDays(c.incorporated, item.id === 'pre-12' ? 0 : offset);
    state[item.id] = { status: 'completed', completedOn };
    if (c.companyType === 'domestic' && ['post-7', 'post-8'].includes(item.id)) {
      state[item.id] = { status: 'not-applicable', notes: 'Indian shareholders only; no foreign investment to report.' };
    }
  });

  const delivered = (days: number) => addDays(c.incorporated, days) + 'T09:30:00.000Z';
  const put = (stepId: string, responses: Record<string, string>, deliveredDays?: number) => {
    const prev = state[stepId]!;
    state[stepId] = { ...prev, responses: { ...(prev.responses ?? {}), ...responses }, ...(deliveredDays != null ? { deliveredToClientAt: delivered(deliveredDays) } : {}) };
  };
  const doc = (name: string) => `${STORAGE_PREFIX}${c.slug}/${name}`;

  put('pre-3', { signedBoardResolutionUrl: doc('signed-board-resolution.pdf') }, -50);
  put('pre-12', {
    cin: c.cin,
    pan: c.pan,
    tan: c.tan,
    dateOfIncorporation: c.incorporated,
    certificateOfIncorporationFinalUrl: doc('certificate-of-incorporation.pdf'),
    panCardFinalUrl: doc('pan-card.pdf'),
    tanCardFinalUrl: doc('tan-card.pdf'),
  }, 1);
  put('pre-13', {
    authorisedShareCapital: String(1_000_000 + c.employees * 50_000),
    paidUpShareCapital: String(500_000 + c.employees * 25_000),
    nominalValuePerEquityShare: '10',
  });
  put('pre-14', {
    registeredOfficeCompleteAddress: c.address,
    registeredOfficeState: c.state,
    registeredOfficeUtilityBillType: 'Electricity bill',
    registeredOfficeUtilityBillNumber: `EB-${c.stateCode}-990${c.employees}`,
    registeredOfficeUtilityBillCopyUrl: doc('utility-bill.pdf'),
    registeredOfficeNocUrl: doc('owner-noc.pdf'),
  });
  const directors: Record<string, string> = {};
  c.directors.forEach((d, i) => {
    const id = `${c.slug.slice(SLUG_PREFIX.length, SLUG_PREFIX.length + 4)}d${i}`;
    const set = (field: string, value: string) => {
      directors[`directors.${id}.${field}`] = value;
    };
    set('firstName', d.first);
    set('lastName', d.last);
    set('gender', d.gender);
    set('indiaResident', d.resident ? 'yes' : 'no');
    set('nationality', d.resident ? 'Indian' : 'Foreign');
    set('din', d.din);
    set('hasDsc', 'yes');
    set('dscExpiryDate', addDays(c.incorporated, 700));
    set('dob', `19${80 + i * 4}-0${i + 3}-1${i + 2}`);
    set('fatherName', `${i === 0 ? 'Ramesh' : 'Suresh'} ${d.last}`);
    set('highestEducationalQualification', i === 0 ? 'Post graduate' : 'Graduate');
    set('occupationType', 'Business');
    set('mobileNumber', `99000${String(10_000 + i * 7 + c.employees).padStart(5, '0')}`);
    set('personalMailId', email(`${d.first}.${d.last}`.toLowerCase()));
    set('panNumber', d.pan);
  });
  put('pre-15', directors);

  if (c.gstDone) {
    for (const id of REG_DONE_WITH_GST) state[id] = { status: 'completed', completedOn: addDays(c.incorporated, id === 'reg-4' ? 30 : 38) };
    put('reg-4', { gstCertificateUrl: doc('gst-certificate.pdf'), gstRegistrationDate: addDays(c.incorporated, 30) }, 31);
    for (const id of REG_IN_PROGRESS) state[id] = { status: 'in-progress' };
  } else {
    // GST ready to start: incorporation is done and the step is open, nothing filed yet.
    state['reg-15'] = { status: 'completed', completedOn: addDays(c.incorporated, 20) };
  }
  for (const id of REG_NOT_APPLICABLE) state[id] = { status: 'not-applicable', notes: NA_NOTE };
  return state;
}

/** reg-4 SBC fields: the GST tracker reads these (filed, ARN, approved with GSTIN). */
function gstFields(c: Company): Array<{ fieldKey: string; value: string }> {
  if (!c.gstDone) return [];
  const filed = addDays(c.incorporated, 16);
  return [
    { fieldKey: 'filed-on', value: filed },
    { fieldKey: 'arn', value: `AA${c.stateCode}${filed.slice(2, 4)}${filed.slice(5, 7)}9999${c.employees}Z` },
    { fieldKey: 'arn-date', value: filed },
    { fieldKey: 'aadhaar', value: 'done' },
    { fieldKey: 'outcome', value: 'approved' },
    { fieldKey: 'number', value: gstinFor(c.stateCode, c.pan) },
    { fieldKey: 'registered-on', value: addDays(c.incorporated, 30) },
    { fieldKey: 'jurisdiction', value: `${c.state} State, Range 9` },
  ];
}

/* ------------------------------------------------------------------ *
 * Seed helpers
 * ------------------------------------------------------------------ */

/** Stop before writing anything if a demo email or slug is held by a real row. */
async function assertNoCollision(): Promise<void> {
  const people = await db.select({ email: profiles.email, isDemo: profiles.isDemo }).from(profiles).where(inArray(profiles.email, PEOPLE.map((p) => p.email)));
  const realPeople = people.filter((p) => !p.isDemo);
  if (realPeople.length) throw new Error(`Refusing: real (non-demo) accounts use ${realPeople.map((p) => p.email).join(', ')}.`);
  const rows = await db.select({ slug: engagements.slug, isDemo: engagements.isDemo }).from(engagements).where(inArray(engagements.slug, COMPANIES.map((c) => c.slug)));
  const real = rows.filter((r) => !r.isDemo);
  if (real.length) throw new Error(`Refusing: real (non-demo) projects use ${real.map((r) => r.slug).join(', ')}.`);
}

async function upsertPerson(p: Person, passwordHash: string): Promise<string> {
  const values = {
    name: p.name,
    role: p.role,
    designation: p.designation,
    internId: p.internId ?? null,
    clientId: p.clientId ?? null,
    passwordHash: p.login ? passwordHash : null,
    status: p.login ? 'active' : 'inactive',
    isDemo: true,
    totpSecretEnc: null,
    totpEnabledAt: null,
    phoneE164: null,
    updatedAt: new Date(),
  };
  const [existing] = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.email, p.email), eq(profiles.isDemo, true))).limit(1);
  if (existing) {
    await db.update(profiles).set(values).where(and(eq(profiles.id, existing.id), eq(profiles.isDemo, true)));
    return existing.id;
  }
  const [row] = await db.insert(profiles).values({ email: p.email, ...values }).returning({ id: profiles.id });
  return row!.id;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

async function main() {
  const name = requireDemoDbName();
  await ensureDemoDatabase();
  await migrateDemoDatabase();
  console.log(`\nSeeding ${describeTarget(name)}\n`);
  await runInDemo(seed);
  process.exit(0);
}

async function seed() {
  const reset = process.argv.includes('--reset');
  await assertNoCollision();

  if (reset) {
    const gone = await db.delete(engagements).where(and(eq(engagements.isDemo, true), inArray(engagements.slug, COMPANIES.map((c) => c.slug)))).returning({ id: engagements.id });
    console.log(`--reset: removed ${gone.length} demo compan${gone.length === 1 ? 'y' : 'ies'} and everything on them.`);
  }

  console.log('Demo people…');
  const hash = await bcrypt.hash(PASSWORD, 10);
  const ids = new Map<string, string>();
  for (const p of PEOPLE) ids.set(p.key, await upsertPerson(p, hash));
  const managerId = ids.get('manager')!;
  const leadId = ids.get('lead')!;
  await db.update(profiles).set({ reportsToManagerId: managerId }).where(and(eq(profiles.id, leadId), eq(profiles.isDemo, true)));

  /* The demo firm's settings (the demo database holds no other firm). */
  const firm = {
    firmName: 'VCFO Suite Demo Firm',
    supportEmail: email('support'),
    supportPhone: null,
    address: 'Demo address, not a real office',
    updatedBy: ids.get('admin')!,
    updatedAt: new Date(),
  };
  await db.insert(firmSettings).values({ id: 'firm', ...firm }).onConflictDoUpdate({ target: firmSettings.id, set: firm });

  await db
    .insert(complianceObligations)
    .values(
      COMPLIANCE_OBLIGATIONS.map((o) => ({
        id: o.id,
        complianceArea: o.complianceArea,
        particular: o.particular,
        authority: o.authority,
        frequency: o.frequency,
        triggerType: o.triggerType,
        dueRule: o.dueRule,
        appliesTo: o.appliesTo,
        applicabilityNote: o.applicabilityNote ?? null,
        isConditional: o.isConditional ?? false,
        penaltyRisk: o.penaltyRisk,
      })),
    )
    .onConflictDoNothing();

  const today = ymd(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const placeholders: Array<{ key: string; title: string }> = [];
  const leadCtx: AuthContext = { userId: leadId, email: email('lead'), name: 'Arjun Rao', role: 'intern', internId: LEAD_INTERN_ID };

  for (const [ci, c] of COMPANIES.entries()) {
    const clientUserId = ids.get(c.clientKey)!;
    const clientId = PEOPLE.find((p) => p.key === c.clientKey)!.clientId!;
    const values = {
      companyName: c.name,
      companyType: c.companyType,
      ownershipType: 'subsidiary',
      parentIndianRelationship: c.companyType === 'domestic' ? 'investing' : null,
      entityLegalForm: 'company',
      incorporationDate: c.incorporated,
      parentEntityName: c.parentName,
      parentEntityAddress: c.parentAddress,
      subsidiaryLegalName: c.name,
      subsidiaryRegisteredAddress: c.address,
      clientId,
      clientUserId,
      clientName: c.clientName,
      internId: LEAD_INTERN_ID,
      managerId,
      stage: 'Post-Incorporation' as const,
      health: c.health,
      checklistState: checklistFor(c),
      complianceQuestionnaire: { 'FI-01': c.companyType === 'foreign', 'GST-01': true, 'EMP-01': c.employees, 'TP-01': c.companyType === 'foreign' },
      expectedCoiOn: null,
      isDemo: true,
      deletedAt: null,
      updatedAt: new Date(),
    };
    const [existing] = await db.select({ id: engagements.id }).from(engagements).where(and(eq(engagements.slug, c.slug), eq(engagements.isDemo, true))).limit(1);
    let id: string;
    if (existing) {
      id = existing.id;
      await db.update(engagements).set(values).where(and(eq(engagements.id, id), eq(engagements.isDemo, true)));
    } else {
      const [row] = await db.insert(engagements).values({ slug: c.slug, ...values, createdAt: new Date(`${addDays(c.incorporated, -75)}T08:00:00Z`) }).returning({ id: engagements.id });
      id = row!.id;
    }
    await db.insert(engagementManagers).values({ engagementId: id, managerId }).onConflictDoNothing();
    await db.insert(engagementLeads).values({ engagementId: id, internId: LEAD_INTERN_ID }).onConflictDoNothing();
    await db.insert(engagementClients).values({ engagementId: id, userId: clientUserId, memberRole: 'owner' }).onConflictDoNothing();

    // Rebuild the seeded rows on this demo engagement.
    await db.delete(documents).where(eq(documents.engagementId, id));
    await db.delete(tasks).where(eq(tasks.engagementId, id));
    await db.delete(activity).where(eq(activity.engagementId, id));
    await db.delete(auditEvents).where(eq(auditEvents.engagementId, id));
    await db.delete(complianceInstances).where(eq(complianceInstances.engagementId, id));
    await db.delete(complianceSubjectFields).where(and(eq(complianceSubjectFields.engagementId, id), eq(complianceSubjectFields.subjectKind, 'registration')));
    await db.delete(budgets).where(eq(budgets.engagementId, id));

    /* GST tracker fields */
    const gst = gstFields(c);
    if (gst.length) {
      await db.insert(complianceSubjectFields).values(gst.map((f) => ({ engagementId: id, subjectKind: 'registration', subjectKey: 'reg-4', side: 'sbc', fieldKey: f.fieldKey, value: f.value, updatedBy: leadId })));
    }

    /* Documents */
    const docs: Array<{ file: string; name: string; category: string; stepId: string; shared: boolean }> = [
      { file: 'signed-board-resolution.pdf', name: 'Board resolution, signed.pdf', category: 'deliverables', stepId: 'pre-3', shared: true },
      { file: 'name-approval.pdf', name: 'Name approval letter (RUN).pdf', category: 'deliverables', stepId: 'pre-5', shared: true },
      { file: 'certificate-of-incorporation.pdf', name: 'Certificate of Incorporation.pdf', category: 'deliverables', stepId: 'pre-12', shared: true },
      { file: 'pan-card.pdf', name: 'PAN allotment letter.pdf', category: 'deliverables', stepId: 'pre-12', shared: true },
      { file: 'tan-card.pdf', name: 'TAN allotment letter.pdf', category: 'deliverables', stepId: 'pre-12', shared: true },
      { file: 'first-board-meeting.pdf', name: 'First board meeting minutes.pdf', category: 'deliverables', stepId: 'post-1', shared: true },
      { file: 'inc-20a.pdf', name: 'INC-20A commencement filing.pdf', category: 'deliverables', stepId: 'post-6', shared: true },
      { file: 'utility-bill.pdf', name: 'Registered office electricity bill.pdf', category: 'Address proof', stepId: 'pre-14', shared: false },
      { file: 'owner-noc.pdf', name: 'NOC from the property owner.pdf', category: 'Address proof', stepId: 'pre-14', shared: false },
      ...(c.gstDone ? [{ file: 'gst-certificate.pdf', name: 'GST registration certificate (REG-06).pdf', category: 'deliverables', stepId: 'reg-4', shared: true }] : []),
    ];
    for (const [i, d] of docs.entries()) {
      const objectKey = `${STORAGE_PREFIX}${c.slug}/${d.file}`;
      placeholders.push({ key: documentStorageKey(objectKey), title: `${c.name}: ${d.name}` });
      await db.insert(documents).values({
        engagementId: id,
        category: d.category,
        fileName: d.name,
        objectKey,
        contentType: 'application/pdf',
        sizeBytes: 152_000 + i * 21_000,
        uploadedBy: leadId,
        stepId: d.stepId,
        sharedWithClient: d.shared,
        reviewStatus: d.shared ? 'approved' : 'none',
        createdAt: new Date(`${addDays(c.incorporated, i * 4 - 20)}T10:00:00Z`),
      });
    }

    /* Tasks for the demo lead */
    const taskSpecs = [
      { title: 'Collect the PF establishment details', description: 'Employer code form, bank letter and the list of employees joining this month.', status: 'in-progress', due: 3 },
      { title: 'File the Professional Tax enrolment', description: 'The rent agreement and the director PAN are already in the vault.', status: 'open', due: 6 },
      { title: 'Prepare the Shops & Establishment application', description: 'Needs the employee count and the office photograph with the name board.', status: 'open', due: 10 },
      ...(c.gstDone ? [] : [{ title: 'Start the GST registration on the portal', description: 'Everything is in the tool; ask Ask VCFO to do the GST registration and hand it to VCFO Assist.', status: 'open', due: 2 }]),
    ];
    for (const t of taskSpecs) {
      await db.insert(tasks).values({ engagementId: id, assignedTo: leadId, assignedBy: managerId, title: t.title, description: t.description, status: t.status, deadline: new Date(`${addDays(today, t.due)}T12:30:00Z`) });
    }

    /* Activity and audit trail */
    const trail = [
      ['engagement.checklist.complete', 'Marked SPICe+ Filing complete', -8],
      ['engagement.checklist.deliver', 'Delivered the Certificate of Incorporation to the client', 1],
      ['document.upload', 'Uploaded the first board meeting minutes', 6],
      ...(c.gstDone ? [['document.upload', 'Uploaded the GST registration certificate', 31]] : []),
    ] as Array<[string, string, number]>;
    for (const [action, summary, days] of trail) {
      await db.insert(auditEvents).values({ actorUserId: leadId, actorRole: 'intern', actorEmail: email('lead'), actorName: 'Arjun Rao', engagementId: id, action, summary, metadata: {}, createdAt: new Date(`${addDays(c.incorporated, days)}T11:00:00Z`) });
    }
    for (const [i, message] of ['shared the certificate of incorporation with the client', 'uploaded the first board meeting minutes', 'marked the monthly GST return filed'].entries()) {
      await db.insert(activity).values({ engagementId: id, actorId: leadId, kind: i === 2 ? 'compliance' : 'document', message, createdAt: new Date(Date.now() - (12 - i * 4) * DAY) });
    }

    /* FY 2026-27 compliance calendar */
    const gstDate = c.gstDone ? addDays(c.incorporated, 30) : null;
    const instances = generateComplianceInstances({
      engagementId: id,
      entityLegalForm: 'company',
      triggers: {
        incorporationDate: c.incorporated,
        gstRegistrationDate: gstDate,
        tanRegistrationDate: c.incorporated,
        pfRegistrationDate: null,
        esiRegistrationDate: null,
        ptRegistrationDate: null,
        tdsLiabilityStartDate: c.incorporated,
        agmDate: null,
      },
      ownerId: leadId,
    });
    let filed = 0;
    let overdue = 0;
    for (const [i, inst] of instances.entries()) {
      const past = inst.dueDate < today;
      // Filed up to the end of last month; this month's past due dates are overdue, except a
      // few already filed; the rest upcoming.
      const isOverdue = past && inst.dueDate >= monthStart && (i + ci) % 3 !== 0;
      const isFiled = past && !isOverdue;
      await db
        .insert(complianceInstances)
        .values({
          engagementId: id,
          obligationId: inst.obligationId,
          dueDate: inst.dueDate,
          periodStart: inst.periodStart ?? null,
          periodEnd: inst.periodEnd ?? null,
          periodLabel: inst.periodLabel ?? '',
          fyLabel: inst.fyLabel ?? null,
          status: isOverdue ? 'overdue' : isFiled ? 'filed' : inst.status,
          ownerId: leadId,
          filedOn: isFiled ? addDays(inst.dueDate, -((i % 4) + 1)) : null,
          filedNote: isFiled ? 'Filed on the portal.' : null,
        })
        .onConflictDoNothing();
      if (isFiled) filed += 1;
      if (isOverdue) overdue += 1;
    }

    /* Budget (FY 2026-27, draft, from the services template) on the first two companies */
    if (ci < 2) {
      await createBudget(leadCtx, { engagementId: id, fyStartYear: 2026, fyStartMonth: 4, templateKey: ci === 0 ? 'services' : 'startup' });
    }

    console.log(`  ${c.name}: incorporation done, GST ${c.gstDone ? 'registered' : 'ready to start'}, ${instances.length} filings (${filed} filed, ${overdue} overdue)`);
  }

  const stored = await seedPlaceholders(placeholders);
  if (stored.failed) console.warn(`  storage not reachable, placeholder PDFs skipped: ${stored.failed}`);
  else console.log(`  ${stored.uploaded} placeholder PDF(s) uploaded, ${stored.existing} already there`);

  /* Receivables sample sheet, owned by the demo manager, the demo lead as editor */
  console.log('Receivables sheet…');
  const SHEET = 'Kaveri Analytics Pvt Ltd';
  let [sheet] = await db.select({ id: receivableSheets.id }).from(receivableSheets).where(and(eq(receivableSheets.managerUserId, managerId), eq(receivableSheets.clientOrgName, SHEET))).limit(1);
  if (!sheet) sheet = await systemCreateSheet({ name: SHEET, clientOrgName: SHEET, managerUserId: managerId });
  await systemAddSheetEditor({ sheetId: sheet.id, userId: leadId, addedBy: managerId });
  await db.delete(receivableInvoices).where(eq(receivableInvoices.sheetId, sheet.id));
  await db.delete(receivablePartners).where(eq(receivablePartners.sheetId, sheet.id));
  const partners = await db
    .insert(receivablePartners)
    .values([
      { sheetId: sheet.id, slug: 'anand', name: 'Anand Pillai', email: email('anand.pillai') },
      { sheetId: sheet.id, slug: 'divya', name: 'Divya Shetty', email: email('divya.shetty') },
    ])
    .returning({ id: receivablePartners.id });
  const invoiceSeeds: Array<{ client: string; no: string; p: number; due: number; amount: number; received?: number }> = [
    { client: 'Brahmaputra Retail', no: 'KA/26-27/041', p: 0, due: -62, amount: 845_000, received: -40 },
    { client: 'Godavari Logistics', no: 'KA/26-27/047', p: 1, due: -45, amount: 1_260_000 },
    { client: 'Sabarmati Textiles', no: 'KA/26-27/052', p: 0, due: -31, amount: 512_500 },
    { client: 'Brahmaputra Retail', no: 'KA/26-27/058', p: 0, due: -18, amount: 930_000, received: -3 },
    { client: 'Mahanadi Power', no: 'KA/26-27/063', p: 1, due: -9, amount: 2_150_000 },
    { client: 'Godavari Logistics', no: 'KA/26-27/066', p: 1, due: -2, amount: 780_000 },
    { client: 'Sabarmati Textiles', no: 'KA/26-27/071', p: 0, due: 6, amount: 640_000 },
    { client: 'Mahanadi Power', no: 'KA/26-27/074', p: 1, due: 14, amount: 1_480_000 },
    { client: 'Krishna Hospitality', no: 'KA/26-27/079', p: 0, due: 25, amount: 395_000 },
  ];
  await db.insert(receivableInvoices).values(
    invoiceSeeds.map((s) => {
      const dueDate = addDays(today, s.due);
      const invoiceDate = addDays(dueDate, -30);
      return {
        sheetId: sheet!.id,
        invoiceMonth: `${invoiceDate.slice(0, 7)}-01`,
        invoiceDate,
        clientName: s.client,
        invoiceNo: s.no,
        partnerId: partners[s.p]!.id,
        dueDate,
        amountInr: s.amount.toFixed(2),
        currency: 'INR',
        status: s.received != null ? 'received' : 'open',
        paidOn: s.received != null ? addDays(today, s.received) : null,
        paidAmount: s.received != null ? s.amount.toFixed(2) : null,
        paidVia: s.received != null ? 'manual' : null,
        createdBy: managerId,
      };
    }),
  );
  const managerCtx: AuthContext = { userId: managerId, email: email('manager'), name: 'Kavya Menon', role: 'manager' };
  await publishSheet(managerCtx, sheet.id, 'Demo data');
  console.log(`  ${invoiceSeeds.length} invoices on "${SHEET}", published; the demo lead is an editor.`);

  console.log(`\nDone. Demo logins (password ${process.env.DEMO_LOGIN_PASSWORD?.trim() ? 'from DEMO_LOGIN_PASSWORD' : 'the default in this script'}):`);
  console.log(`  ${email('admin')}    firm admin of the demo firm`);
  console.log(`  ${email('manager')}  project manager of the three demo companies`);
  console.log(`  ${email('lead')}     project lead on all three demo companies`);
  console.log(`  ${email('client')}   client portal of Kaveri Analytics`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
