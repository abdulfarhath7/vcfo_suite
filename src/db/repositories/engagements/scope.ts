import 'server-only';
import { and, eq, getTableColumns, inArray, isNull, or, sql } from 'drizzle-orm';
import { engagements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { isFirmWideAdmin } from '@/lib/auth';
import { listClientMemberEngagementIds } from '@/db/repositories/engagement-clients';
import { listLeadMemberEngagementIds } from '@/db/repositories/engagement-leads-membership';
import { listManagerMemberEngagementIds } from '@/db/repositories/engagement-managers-membership';

export type EngagementDbRow = typeof engagements.$inferSelect;
export type EngagementChecklistState = Record<string, ChecklistItemStateSlice>;
/** List/directory rows — same columns as the table except the jsonb blob. */
export type EngagementListRow = Omit<EngagementDbRow, 'checklistState'>;

const { checklistState: _checklistState, ...engagementListColumns } = getTableColumns(engagements);
void _checklistState;

/**
 * Postgres-side slim of checklist_state: drop answers/notes, keep status +
 * sequential-gate fields and the few compliance trigger dates.
 */
export const checklistIndexSql = sql<Record<string, unknown>>`
  COALESCE(
    (
      SELECT jsonb_object_agg(
        kv.key,
        (kv.value - 'responses' - 'notes')
        || jsonb_build_object(
          'responses',
          jsonb_strip_nulls(
            jsonb_build_object(
              'dateOfIncorporation', kv.value #>> '{responses,dateOfIncorporation}',
              'gstRegistrationDate', kv.value #>> '{responses,gstRegistrationDate}',
              'pfRegistrationDate', kv.value #>> '{responses,pfRegistrationDate}',
              'esiRegistrationDate', kv.value #>> '{responses,esiRegistrationDate}',
              'panTanAllotmentDate', kv.value #>> '{responses,panTanAllotmentDate}'
            )
          )
        )
      )
      FROM jsonb_each(engagements.checklist_state) AS kv
    ),
    '{}'::jsonb
  )
`;

/**
 * ENGAGEMENTS REPOSITORY — the reference implementation of the seam.
 *
 * This is the ONLY place engagements are read/written. Everything above the
 * seam (views, domain logic) calls these functions and never touches `db`.
 *
 * >>> ACCESS CONTROL (Path A) lives HERE. <<<
 * Four-role model:
 *   admin   — unrestricted (firm-wide), like the old manager role
 *   manager — engagements where manager_id = ctx.userId
 *             (legacy fallback: manager_id IS NULL AND admin_id = ctx.userId)
 *   intern  — intern_id = ctx.internId
 *   client  — client_user_id = ctx.userId OR client_id = ctx.clientId
 */

/** SQL predicate: project manager owns this engagement (incl. legacy admin_id). */
export function managerOwnsEngagement(userId: string) {
  return or(
    eq(engagements.managerId, userId),
    and(isNull(engagements.managerId), eq(engagements.adminId, userId)),
  );
}

/** True when a loaded row is owned by this manager (legacy-aware). */
export function rowOwnedByManager(
  row: Pick<EngagementDbRow, 'managerId' | 'adminId'>,
  userId: string,
): boolean {
  return (
    row.managerId === userId ||
    (row.managerId == null && row.adminId === userId)
  );
}

/** Build the role-scoped WHERE clause used by list/get. Soft-deleted rows excluded. */
export async function scopeFor(ctx: AuthContext) {
  const notDeleted = isNull(engagements.deletedAt);
  if (isFirmWideAdmin(ctx.role)) return notDeleted;
  if (ctx.role === 'manager') {
    const memberIds = await listManagerMemberEngagementIds(ctx.userId);
    const conds = [managerOwnsEngagement(ctx.userId)];
    if (memberIds.length > 0) conds.push(inArray(engagements.id, memberIds));
    const roleScope = conds.length === 1 ? conds[0] : or(...conds);
    return and(notDeleted, roleScope);
  }
  if (ctx.role === 'intern') {
    if (!ctx.internId) return eq(engagements.id, '__none__');
    const memberIds = await listLeadMemberEngagementIds(ctx.internId);
    const conds = [eq(engagements.internId, ctx.internId)];
    if (memberIds.length > 0) conds.push(inArray(engagements.id, memberIds));
    const roleScope = conds.length === 1 ? conds[0] : or(...conds);
    return and(notDeleted, roleScope);
  }
  // client — primary pointer, org clientId, or engagement_clients membership
  const memberIds = await listClientMemberEngagementIds(ctx.userId);
  const conds = [];
  conds.push(eq(engagements.clientUserId, ctx.userId));
  if (ctx.clientId) conds.push(eq(engagements.clientId, ctx.clientId));
  if (memberIds.length > 0) conds.push(inArray(engagements.id, memberIds));
  const roleScope = conds.length === 1 ? conds[0] : or(...conds);
  return and(notDeleted, roleScope);
}

export { engagementListColumns };
