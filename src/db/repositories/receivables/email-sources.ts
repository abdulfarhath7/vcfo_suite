import 'server-only';
import { and, asc, desc, eq, inArray, isNull, max } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, receivableClients, receivableDigestRecipients, receivableEmailLog, receivableInvoices, receivablePartners, receivableSheets } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { EmailInvoice } from '@/lib/receivables/email-v2';
import { UUID, invalid, notFound, num, scopedSheet, type SheetRow } from './shared';

/**
 * RECEIVABLES v2 — what the five emails are built from (docs/specs/receivables/V2.md).
 *
 * The `system*` functions are called only by the Inngest jobs (src/jobs/receivables-*.ts), or by
 * `after()` work a scoped route already checked; they skip `ctx` because a job has no caller. Each
 * returns one sheet's data for that sheet's own partners, recipients and manager only.
 * `clientStatementSource` takes the caller's AuthContext and goes through `scopedSheet`.
 */

export type EmailInvoiceRow = EmailInvoice & { id: string; partnerId: string | null; clientId: string | null; revision: number };

function toEmailInvoice(row: typeof receivableInvoices.$inferSelect): EmailInvoiceRow {
  return {
    id: row.id,
    clientName: row.clientName,
    invoiceNo: row.invoiceNo,
    invoiceDate: row.invoiceDate ? String(row.invoiceDate) : null,
    dueDate: String(row.dueDate),
    amountInr: num(row.amountInr) ?? 0,
    partnerId: row.partnerId,
    clientId: row.clientId,
    revision: row.revision,
  };
}

export type SheetEmailSettings = Pick<
  SheetRow,
  | 'id'
  | 'name'
  | 'clientOrgName'
  | 'managerUserId'
  | 'digestEnabled'
  | 'digestWeekday'
  | 'digestHourIst'
  | 'rollupEveryDays'
  | 'sendHourIst'
  | 'emailNewInvoiceEnabled'
  | 'emailRollupEnabled'
  | 'emailRevisedEnabled'
>;

export type PartnerContact = { id: string; name: string; email: string; active: boolean; notifyNewInvoice: boolean; notifyRollup: boolean };

/** SYSTEM: one sheet's email switches. */
export async function systemSheetEmailSettings(sheetId: string): Promise<SheetEmailSettings | null> {
  if (!UUID.test(sheetId ?? '')) return null;
  const [row] = await db.select().from(receivableSheets).where(eq(receivableSheets.id, sheetId)).limit(1);
  return row ?? null;
}

/** SYSTEM: every sheet with at least one automatic email switched on. */
export async function systemSheetsWithAutoEmails(): Promise<SheetEmailSettings[]> {
  const rows = await db.select().from(receivableSheets).orderBy(asc(receivableSheets.name));
  return rows.filter((r) => r.emailRollupEnabled || r.digestEnabled);
}

/** SYSTEM: the sheet's client partners. */
export async function systemSheetPartners(sheetId: string): Promise<PartnerContact[]> {
  const rows = await db.select().from(receivablePartners).where(eq(receivablePartners.sheetId, sheetId)).orderBy(asc(receivablePartners.name));
  return rows.map((p) => ({ id: p.id, name: p.name, email: p.email, active: p.active, notifyNewInvoice: p.notifyNewInvoice, notifyRollup: p.notifyRollup }));
}

/** SYSTEM: the given live invoices of one sheet (the ones an approval just made or changed). */
export async function systemInvoicesById(sheetId: string, ids: string[]): Promise<EmailInvoiceRow[]> {
  const clean = ids.filter((id) => UUID.test(id));
  if (!clean.length) return [];
  const rows = await db
    .select()
    .from(receivableInvoices)
    .where(and(eq(receivableInvoices.sheetId, sheetId), inArray(receivableInvoices.id, clean), isNull(receivableInvoices.deletedAt)));
  return rows.map(toEmailInvoice);
}

/** SYSTEM: every open live invoice of one sheet (roll-up and digest). Disputed invoices are left out. */
export async function systemOpenInvoices(sheetId: string): Promise<EmailInvoiceRow[]> {
  const rows = await db
    .select()
    .from(receivableInvoices)
    .where(and(eq(receivableInvoices.sheetId, sheetId), eq(receivableInvoices.status, 'open'), isNull(receivableInvoices.deletedAt)))
    .orderBy(asc(receivableInvoices.clientName), asc(receivableInvoices.dueDate));
  return rows.filter((r) => !(r.disputedAt && !r.disputeResolvedAt)).map(toEmailInvoice);
}

/** SYSTEM: the active leadership digest recipients of one sheet. */
export async function systemDigestRecipients(sheetId: string): Promise<Array<{ name: string; email: string }>> {
  const rows = await db
    .select({ name: receivableDigestRecipients.name, email: receivableDigestRecipients.email })
    .from(receivableDigestRecipients)
    .where(and(eq(receivableDigestRecipients.sheetId, sheetId), eq(receivableDigestRecipients.active, true)))
    .orderBy(asc(receivableDigestRecipients.name));
  return rows;
}

/** SYSTEM: a staff member's name (the "Regards, <name> · SBC" line). */
export async function systemStaffName(userId: string | null): Promise<string> {
  if (!userId || !UUID.test(userId)) return 'SBC';
  const [row] = await db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row?.name?.trim() || 'SBC';
}

/** SYSTEM: the IST date (`period_key`) of the sheet's last roll-up that went out or is going. */
export async function systemLastRollupDate(sheetId: string): Promise<string | null> {
  const [row] = await db
    .select({ last: max(receivableEmailLog.periodKey) })
    .from(receivableEmailLog)
    .where(and(eq(receivableEmailLog.sheetId, sheetId), eq(receivableEmailLog.kind, 'rollup'), inArray(receivableEmailLog.status, ['sending', 'sent'])));
  return row?.last ?? null;
}

/** The latest roll-up date and digest date of a sheet, for the People tab's schedule. */
export async function lastAutoSends(ctx: AuthContext, sheetId: string): Promise<{ rollup: string | null; digest: string | null }> {
  const sheet = await scopedSheet(ctx, sheetId);
  const rows = await db
    .select({ kind: receivableEmailLog.kind, periodKey: receivableEmailLog.periodKey })
    .from(receivableEmailLog)
    .where(and(eq(receivableEmailLog.sheetId, sheet.id), inArray(receivableEmailLog.kind, ['rollup', 'digest']), inArray(receivableEmailLog.status, ['sending', 'sent'])))
    .orderBy(desc(receivableEmailLog.periodKey))
    .limit(40);
  return { rollup: rows.find((r) => r.kind === 'rollup')?.periodKey ?? null, digest: rows.find((r) => r.kind === 'digest')?.periodKey ?? null };
}

/** Email D: one client's open invoices and where the statement goes, for a person who may edit the sheet. */
export async function clientStatementSource(
  ctx: AuthContext,
  clientId: string,
): Promise<{ sheetId: string; client: { id: string; name: string; billingEmail: string; billingCc: string[] }; invoices: EmailInvoiceRow[] }> {
  if (!UUID.test(clientId ?? '')) throw notFound();
  const [client] = await db.select().from(receivableClients).where(eq(receivableClients.id, clientId)).limit(1);
  if (!client) throw notFound();
  const sheet = await scopedSheet(ctx, client.sheetId);
  if (!client.billingEmail) throw invalid('no_billing_email');
  const rows = await db
    .select()
    .from(receivableInvoices)
    .where(and(eq(receivableInvoices.sheetId, sheet.id), eq(receivableInvoices.clientId, client.id), eq(receivableInvoices.status, 'open'), isNull(receivableInvoices.deletedAt)))
    .orderBy(asc(receivableInvoices.dueDate));
  if (!rows.length) throw invalid('nothing_open');
  return { sheetId: sheet.id, client: { id: client.id, name: client.name, billingEmail: client.billingEmail, billingCc: client.billingCc ?? [] }, invoices: rows.map(toEmailInvoice) };
}
