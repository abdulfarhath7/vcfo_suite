import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { receivableChanges, receivableInvoices, receivableSheetEditors, receivableSheets } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import type { PaidVia, SheetInvoice } from '@/lib/receivables/model';
import { isReceivablesStaffRole } from '@/lib/receivables/roles';

/**
 * RECEIVABLES — shared parts: who may act, errors, row mapping and the change log.
 *
 * >>> ACCESS CONTROL (docs/specs/receivables/PLAN.md) <<<
 *   A sheet belongs to one manager (`receivable_sheets.manager_user_id`). That manager, the
 *   firm-wide admins (super admin, admin) and the staff named in `receivable_sheet_editors` read
 *   and write it; any other manager or project lead reads it as not found. Clients, partners and
 *   developers are refused before the first query. A signed-in client
 *   partner reads only their own rows of the latest published snapshot, through
 *   partner-portal.ts (the public key link was retired in Phase 8).
 */

export type SheetRow = typeof receivableSheets.$inferSelect;
export type InvoiceRow = typeof receivableInvoices.$inferSelect;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ReceivablesError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    readonly code: string,
  ) {
    super(code);
  }
}

export const notFound = () => new ReceivablesError(404, 'not_found');
export const invalid = (code: string) => new ReceivablesError(400, code);
export const conflict = (code: string) => new ReceivablesError(409, code);

/** Throws before any query for a role that can never edit a sheet. */
export function assertEditorRole(ctx: AuthContext): void {
  if (!isReceivablesStaffRole(ctx.role)) throw notFound();
}

/** The part of the rule that needs no query: a firm-wide admin or the sheet's own manager. */
export function mayEditSheet(ctx: AuthContext, sheet: Pick<SheetRow, 'managerUserId'>): boolean {
  return isFirmWideAdmin(ctx.role) || (sheet.managerUserId !== null && sheet.managerUserId === ctx.userId);
}

/** True when the person is named as an extra editor of the sheet. */
export async function isSheetEditor(userId: string, sheetId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: receivableSheetEditors.userId })
    .from(receivableSheetEditors)
    .where(and(eq(receivableSheetEditors.sheetId, sheetId), eq(receivableSheetEditors.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/** The full rule: a firm-wide admin, the sheet's manager, or one of its extra editors. */
export async function canEditSheet(ctx: AuthContext, sheet: Pick<SheetRow, 'id' | 'managerUserId'>): Promise<boolean> {
  if (!isReceivablesStaffRole(ctx.role)) return false;
  return mayEditSheet(ctx, sheet) || (await isSheetEditor(ctx.userId, sheet.id));
}

/** The sheet, if and only if the caller may edit it; anything else reads as not found. */
export async function scopedSheet(ctx: AuthContext, sheetId: string): Promise<SheetRow> {
  assertEditorRole(ctx);
  if (!UUID.test(sheetId ?? '')) throw notFound();
  const [sheet] = await db.select().from(receivableSheets).where(eq(receivableSheets.id, sheetId)).limit(1);
  if (!sheet || !(await canEditSheet(ctx, sheet))) throw notFound();
  return sheet;
}

/** A live invoice and its sheet, if and only if the caller may edit that sheet. */
export async function scopedInvoice(ctx: AuthContext, invoiceId: string): Promise<{ invoice: InvoiceRow; sheet: SheetRow }> {
  assertEditorRole(ctx);
  if (!UUID.test(invoiceId ?? '')) throw notFound();
  const [invoice] = await db
    .select()
    .from(receivableInvoices)
    .where(and(eq(receivableInvoices.id, invoiceId), isNull(receivableInvoices.deletedAt)))
    .limit(1);
  if (!invoice) throw notFound();
  const sheet = await scopedSheet(ctx, invoice.sheetId);
  return { invoice, sheet };
}

/** Postgres `numeric` arrives as a string; the domain works in plain rupees. */
export function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Back to `numeric(14,2)` text. */
export function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function toInvoice(row: InvoiceRow): SheetInvoice {
  return {
    id: row.id,
    invoiceMonth: String(row.invoiceMonth),
    clientName: row.clientName,
    invoiceNo: row.invoiceNo,
    partnerId: row.partnerId,
    dueDate: String(row.dueDate),
    amountInr: num(row.amountInr) ?? 0,
    status: row.status === 'received' ? 'received' : 'open',
    paidOn: row.paidOn ? String(row.paidOn) : null,
    paidAmount: num(row.paidAmount),
    paidVia: (row.paidVia as PaidVia | null) ?? null,
    partPaid: num(row.partPaid) ?? 0,
    remindersPausedUntil: row.remindersPausedUntil ? String(row.remindersPausedUntil) : null,
    pauseReason: row.pauseReason,
    currency: (row.currency ?? 'INR').trim().toUpperCase() || 'INR',
    fcAmount: num(row.fcAmount),
    fxRate: num(row.fxRate),
    invoiceDate: row.invoiceDate ? String(row.invoiceDate) : null,
    receivedFc: num(row.receivedFc),
    tdsInr: num(row.tdsInr) ?? 0,
    disputed: Boolean(row.disputedAt) && !row.disputeResolvedAt,
  };
}

/** "Duravant SC/09/03" — how a change names its invoice. */
export function invoiceLabel(row: Pick<InvoiceRow, 'clientName' | 'invoiceNo'>): string {
  return row.invoiceNo ? `${row.clientName} ${row.invoiceNo}` : row.clientName;
}

type DbLike = Pick<typeof db, 'insert'>;

export async function logChange(
  input: {
    sheetId: string;
    invoiceId: string | null;
    actorId: string | null;
    summary: string;
    field?: string;
    before?: string | null;
    after?: string | null;
    affectsPage?: boolean;
  },
  tx: DbLike = db,
): Promise<void> {
  await tx.insert(receivableChanges).values({
    sheetId: input.sheetId,
    invoiceId: input.invoiceId,
    actorId: input.actorId,
    summary: input.summary,
    field: input.field ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    affectsPage: input.affectsPage ?? true,
  });
}
