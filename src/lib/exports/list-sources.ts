import 'server-only';
import type { AuthContext } from '@/auth/guards';
import { listAuditEvents } from '@/db/repositories/audit-events';
import { listEngagements } from '@/db/repositories/engagements';
import type { AuditEventRow } from '@/lib/audit/audit-log';
import { checklistItemLabel } from '@/lib/audit/audit-log';
import { loadStaffEngagements } from '@/lib/ask/tools/staff-data';
import type { ExportTable, TableCell } from '@/lib/exports/table-xlsx';
import {
  listPendingApprovals,
  pendingApprovalKind,
  pendingApprovalKindKey,
  type PendingApprovalKindKey,
} from '@/lib/projects/pending-approvals';
import { AUDIT_EXPORT_HEAD, auditEventCells } from '@/views/admin/audit-log/audit-csv';
import { filterAuditEvents, type AuditFilters } from '@/views/admin/audit-log/audit-filters';

/**
 * GL-06: the server side of "Export to Excel". A list whose rows the server can rebuild names its
 * source, and the rows are read here through the repositories with the caller's `AuthContext`, so
 * the file holds every matching row (not only the pages loaded) and never more than the role may
 * see. Lists whose columns are worked out in the browser send their rows, and
 * `scopeRowsToClients` drops any row about a client outside the caller's scope.
 */

/** The audit log reads 500 events a page; an export stops at this many matching rows. */
export const AUDIT_EXPORT_MAX_ROWS = 50_000;
const AUDIT_PAGE = 500;

export type ListSource =
  | { source: 'audit-log'; engagementId?: string | null; filters: AuditFilters }
  | { source: 'approvals'; scope: 'firm' | 'manager'; kind: 'all' | PendingApprovalKindKey };

const IST_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
const IST_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** One audit event as export cells, with the date and time in Indian Standard Time. */
export function auditExportCells(ev: AuditEventRow, names: Map<string, string>): TableCell[] {
  const cells: TableCell[] = auditEventCells(ev, names);
  const when = new Date(ev.created_at);
  if (!Number.isNaN(when.getTime())) {
    cells[0] = IST_DATE.format(when);
    cells[1] = IST_TIME.format(when);
  }
  return cells;
}

/** Engagement database id to company name, for every engagement the caller may see. */
async function scopedCompanyNames(ctx: AuthContext): Promise<Map<string, string>> {
  const rows = await listEngagements(ctx);
  return new Map(rows.map((r) => [r.id, r.companyName]));
}

/** Every audit event the caller may see that the filters keep, newest first, read page by page. */
export async function auditLogExportRows(
  ctx: AuthContext,
  input: { engagementId?: string | null; filters: AuditFilters },
  maxRows = AUDIT_EXPORT_MAX_ROWS,
): Promise<TableCell[][]> {
  const names = await scopedCompanyNames(ctx);
  const out: TableCell[][] = [];
  let before: Date | undefined;
  let beforeId: string | undefined;
  for (;;) {
    const page = await listAuditEvents(ctx, { engagementId: input.engagementId || null, before, beforeId, limit: AUDIT_PAGE + 1 });
    const events = page.slice(0, AUDIT_PAGE);
    for (const ev of filterAuditEvents(events, input.filters, names)) {
      out.push(auditExportCells(ev, names));
      if (out.length >= maxRows) return out;
    }
    const last = events.at(-1);
    if (page.length <= AUDIT_PAGE || !last) return out;
    before = new Date(last.created_at);
    beforeId = last.id;
  }
}

/** The approvals inbox, as the browser builds it (`usePendingApprovals`), from the scoped engagements. */
export async function approvalsExportRows(
  ctx: AuthContext,
  input: { scope: 'firm' | 'manager'; kind: 'all' | PendingApprovalKindKey },
): Promise<TableCell[][]> {
  const engagements = (await loadStaffEngagements(ctx)).filter(
    (e) => !(input.scope === 'manager' && ctx.role === 'manager' && e.engagement.managerId && e.engagement.managerId !== ctx.userId),
  );
  const byId = new Map(engagements.map((e) => [e.engagement.id, e.state]));
  return listPendingApprovals(
    engagements.map((e) => e.engagement),
    (eng) => byId.get(eng.id) ?? {},
  )
    .filter((row) => input.kind === 'all' || pendingApprovalKindKey(row) === input.kind)
    .map((row) => [checklistItemLabel(row.itemId), row.companyName, pendingApprovalKind(row), row.clientFill?.note ?? null]);
}

export const APPROVALS_EXPORT_HEAD = ['Step', 'Client', 'Kind', 'Note'];

/** The table a named source exports, read with the caller's scope. */
export async function listSourceTable(ctx: AuthContext, title: string, input: ListSource): Promise<ExportTable> {
  if (input.source === 'audit-log') {
    return { sheet: title, columns: AUDIT_EXPORT_HEAD, rows: await auditLogExportRows(ctx, input) };
  }
  return { sheet: title, columns: APPROVALS_EXPORT_HEAD, rows: await approvalsExportRows(ctx, input) };
}

/** The column that names the client, when the list has one ("Client"). */
export function clientColumnOf(columns: string[]): number {
  return columns.findIndex((c) => c.trim().toLowerCase() === 'client');
}

/**
 * Browser-built rows, kept only when the client they name is one the caller may see. A row with
 * no client in that column (a firm-wide line) is kept. Names compare without case or extra spaces.
 */
export function keepScopedRows(rows: TableCell[][], clientColumn: number, allowed: ReadonlySet<string>): TableCell[][] {
  if (clientColumn < 0) return rows;
  return rows.filter((row) => {
    const cell = row[clientColumn];
    const name = typeof cell === 'string' ? normaliseName(cell) : '';
    return !name || allowed.has(name);
  });
}

export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The caller's client names, for `keepScopedRows` and for the file name's client. */
export async function scopedClientNameSet(ctx: AuthContext): Promise<Set<string>> {
  const names = await scopedCompanyNames(ctx);
  return new Set([...names.values()].map(normaliseName));
}
