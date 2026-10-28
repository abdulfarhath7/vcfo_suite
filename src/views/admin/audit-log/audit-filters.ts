import type { AuditActionCategory, AuditEventRow } from '@/lib/audit/audit-log';
import {
  formatActorDisplay,
  formatAuditActionLabel,
  getAuditActionCategory,
  getAuditTargetType,
} from '@/lib/audit/audit-log';
import type { DbRole } from '@/lib/auth';

export type AuditFilters = {
  search: string;
  role: 'all' | DbRole;
  category: 'all' | AuditActionCategory;
};

export const AUDIT_CATEGORY_LABELS: Record<AuditActionCategory, string> = {
  engagement: 'Projects',
  checklist: 'Milestones',
  documents: 'Documents',
  admin: 'Team',
  email: 'Email',
  other: 'Other',
};

export const defaultAuditFilters = (): AuditFilters => ({
  search: '',
  role: 'all',
  category: 'all',
});

export function auditFiltersSet(filters: AuditFilters): boolean {
  return filters.role !== 'all' || filters.category !== 'all' || filters.search.trim() !== '';
}

export function filterAuditEvents(
  events: AuditEventRow[],
  filters: AuditFilters,
  engagementsByDbId: Map<string, string>,
): AuditEventRow[] {
  const query = filters.search.trim().toLowerCase();
  return events.filter((ev) => {
    if (filters.role !== 'all' && ev.actor_role !== filters.role) return false;
    if (filters.category !== 'all' && getAuditActionCategory(ev.action) !== filters.category) return false;
    if (!query) return true;

    const projectName = ev.engagement_id ? engagementsByDbId.get(ev.engagement_id) ?? '' : '';
    const haystack = [
      ev.summary,
      ev.action,
      formatAuditActionLabel(ev.action),
      formatActorDisplay(ev),
      ev.actor_email ?? '',
      ev.actor_name ?? '',
      projectName,
      getAuditTargetType(ev.action),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}
