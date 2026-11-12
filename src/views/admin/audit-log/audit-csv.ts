import { format } from 'date-fns';
import { standardNameFromFile } from '@/lib/files/download-name';
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

/** The rows in view as CSV text (prototype Audit export). One line per event, newest first. */
export function auditEventsCsv(events: AuditEventRow[], engagementsByDbId: Map<string, string>): string {
  const lines = events.map((ev) =>
    auditEventCells(ev, engagementsByDbId)
      .map((v) => quote(String(v)))
      .join(','),
  );
  return [AUDIT_EXPORT_HEAD.join(','), ...lines].join('\n');
}

/** Save the CSV text through a temporary link. Browser only. */
export function downloadCsv(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = standardNameFromFile(filename);
  a.click();
  URL.revokeObjectURL(url);
}
