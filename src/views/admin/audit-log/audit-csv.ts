import { format } from 'date-fns';
import type { AuditEventRow } from '@/lib/audit/audit-log';
import { formatActorDisplay, formatAuditActionLabel, getAuditActionCategory } from '@/lib/audit/audit-log';
import { mapDbRoleToAppRole, ROLE_UI_LABEL } from '@/lib/auth';
import { AUDIT_CATEGORY_LABELS } from '@/views/admin/audit-log/audit-filters';

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** The rows in view as CSV text (prototype Audit export). One line per event, newest first. */
export function auditEventsCsv(events: AuditEventRow[], engagementsByDbId: Map<string, string>): string {
  const head = ['Date', 'Time', 'Event', 'Summary', 'Area', 'Who', 'Role', 'Email', 'Project'];
  const lines = events.map((ev) => {
    const when = new Date(ev.created_at);
    const project = ev.engagement_id ? engagementsByDbId.get(ev.engagement_id) ?? '' : '';
    return [
      format(when, 'd MMM yyyy'),
      format(when, 'HH:mm'),
      formatAuditActionLabel(ev.action),
      ev.summary ?? '',
      AUDIT_CATEGORY_LABELS[getAuditActionCategory(ev.action)],
      formatActorDisplay(ev),
      ROLE_UI_LABEL[mapDbRoleToAppRole(ev.actor_role)],
      ev.actor_email ?? '',
      project,
    ]
      .map((v) => quote(String(v)))
      .join(',');
  });
  return [head.join(','), ...lines].join('\n');
}

/** Save the CSV text through a temporary link. Browser only. */
export function downloadCsv(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
