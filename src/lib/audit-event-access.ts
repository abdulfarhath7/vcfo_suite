/**
 * Path A audit-log visibility (mirrors `src/db/repositories/audit-events.ts`).
 * Unit tests use this so intern/manager isolation does not need a live database.
 *
 * "Same clients" = engagement DB ids from Path A `listEngagements`:
 *   intern  — `engagements.intern_id` + `engagement_leads` membership
 *   manager — `engagements.manager_id` (+ legacy admin_id) + `engagement_managers`
 *   client  — primary client pointer + `engagement_clients`
 *
 * Admin / super_admin stay firm-wide. Interns always see their own actor rows
 * (even with a null engagement_id). Managers do not — unscoped / other-client
 * rows are dropped.
 */

export type AuditEventAccessRow = {
  actorUserId: string;
  engagementId: string | null;
};

export function isFirmWideAuditReader(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
}

/** Whether this viewer may request a single-engagement audit feed. */
export function canQueryAuditEngagement(
  role: string,
  scopedEngagementIds: readonly string[],
  engagementId: string,
): boolean {
  if (isFirmWideAuditReader(role)) return true;
  return scopedEngagementIds.includes(engagementId);
}

export function auditEventVisibleToViewer(input: {
  role: string;
  userId: string;
  /** Assigned/owned engagement DB ids (from `listEngagements`). */
  scopedEngagementIds: readonly string[];
  event: AuditEventAccessRow;
  /** When set, the list is a project feed — no own-actor leak from other clients. */
  requestedEngagementId?: string | null;
}): boolean {
  const { role, userId, scopedEngagementIds, event, requestedEngagementId } = input;

  if (isFirmWideAuditReader(role)) {
    if (requestedEngagementId) return event.engagementId === requestedEngagementId;
    return true;
  }

  if (requestedEngagementId) {
    if (!scopedEngagementIds.includes(requestedEngagementId)) return false;
    return event.engagementId === requestedEngagementId;
  }

  if (role === 'intern') {
    if (event.actorUserId === userId) return true;
    return (
      event.engagementId != null && scopedEngagementIds.includes(event.engagementId)
    );
  }

  if (role === 'manager' || role === 'client') {
    return (
      event.engagementId != null && scopedEngagementIds.includes(event.engagementId)
    );
  }

  return false;
}

export function filterAuditEventsForViewer<T extends AuditEventAccessRow>(
  input: {
    role: string;
    userId: string;
    scopedEngagementIds: readonly string[];
    events: T[];
    requestedEngagementId?: string | null;
  },
): T[] {
  return input.events.filter((event) =>
    auditEventVisibleToViewer({ ...input, event }),
  );
}
