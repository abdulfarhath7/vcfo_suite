import { format } from 'date-fns';
import type { AuditEventRow } from '@/lib/audit/audit-log';
import { formatActorDisplay, formatAuditActionLabel } from '@/lib/audit/audit-log';
import { mapDbRoleToAppRole, ROLE_UI_LABEL } from '@/lib/auth';
import { AUDIT_CATEGORY_LABELS, auditAreaOf, auditResultWord } from '@/views/admin/audit-log/audit-filters';

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** The export columns, shared by the CSV and the Excel export (GL-06). */
export const AUDIT_EXPORT_HEAD = ['Date', 'Time', 'Event', 'Summary', 'Area', 'Who', 'Role', 'Email', 'Result', 'Project'];

/** One event as the export cells, in the order of `AUDIT_EXPORT_HEAD`. */
export function auditEventCells(ev: AuditEventRow, engagementsByDbId: Map<string, string>): string[] {
  const when = new Date(ev.created_at);
  const project = ev.engagement_id ? engagementsByDbId.get(ev.engagement_id) ?? '' : '';
  return [
    format(when, 'd MMM yyyy'),
    format(when, 'HH:mm'),
    formatAuditActionLabel(ev.action),
    ev.summary ?? '',
    AUDIT_CATEGORY_LABELS[auditAreaOf(ev.action)],
    formatActorDisplay(ev),
    ROLE_UI_LABEL[mapDbRoleToAppRole(ev.actor_role)],
    ev.actor_email ?? '',
    auditResultWord(ev),
    project,
  ];
}

/**
 * Export rows as CSV text under `AUDIT_EXPORT_HEAD` (prototype Audit export). The server builds
 * the rows with the caller's scope (`auditLogExportRows`), so the CSV holds every event the
 * filters keep, not only the pages loaded, newest first.
 */
export function auditRowsCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null>>): string {
  const lines = rows.map((cells) => cells.map((v) => quote(String(v ?? ''))).join(','));
  return [AUDIT_EXPORT_HEAD.join(','), ...lines].join('\n');
}

/** The CSV download of the audit log (`/api/exports/audit-log`) for the filters on screen. */
export function auditCsvHref(input: {
  engagementId?: string | null;
  filters: { search: string; role: string; category: string };
  name: string;
  client?: string | null;
}): string {
  const q = new URLSearchParams({ search: input.filters.search, role: input.filters.role, category: input.filters.category, name: input.name });
  if (input.engagementId) q.set('engagementId', input.engagementId);
  if (input.client) q.set('client', input.client);
  return `/api/exports/audit-log?${q.toString()}`;
}
