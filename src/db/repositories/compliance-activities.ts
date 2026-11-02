import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceActivities, complianceObligations } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { ACTIVITY_SEED, OBLIGATION_ACTIVITY } from '@/data/compliance-activities';
import { recordAuditEvent } from './audit-events';

/**
 * COMPLIANCE ACTIVITIES — the activity master (DR-01) in `compliance_activities`.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   read  — super admin, admin, manager, lead and client. The `confirm` point (DR-19) is
 *           returned to super admin and admin only (D-4); everyone else gets null.
 *   write — super admin and admin: notify days, roles, visibility of a non-statutory row,
 *           and confirming the open point. Every change writes an audit row.
 *   system — `systemEnsureActivitiesSeeded` inserts the 43 rows of
 *           `src/data/compliance-activities.ts` when they are missing (never overwrites an
 *           edit) and links each register obligation to its activity when it has none.
 */

export interface ActivityDto {
  id: string;
  name: string;
  kind: string;
  group: 'statutory' | 'non-statutory';
  frequency: string;
  module: string;
  area: string;
  dueRule: string;
  penalty: string;
  applies: string;
  ownerRole: string;
  reviewerRole: string;
  notifyDays: number;
  visibility: 'firm' | 'client' | 'both';
  note: string;
  confirm: string | null;
  confirmedAt: string | null;
  from: 'master' | 'manual';
}

export type ActivityRow = typeof complianceActivities.$inferSelect;

const READERS = new Set(['super_admin', 'admin', 'manager', 'intern', 'client']);

export class ActivityError extends Error {
  constructor(
    readonly status: 403 | 404 | 400,
    readonly code: string,
  ) {
    super(code);
  }
}

/** True while the activity has an open point nobody confirmed (DR-19, DR-22). */
export function confirmPending(row: Pick<ActivityRow, 'confirm' | 'confirmedAt'> | null | undefined): boolean {
  return Boolean(row?.confirm?.trim()) && !row?.confirmedAt;
}

export function toActivityDto(row: ActivityRow, role: string): ActivityDto {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    group: row.activityGroup === 'statutory' ? 'statutory' : 'non-statutory',
    frequency: row.frequency,
    module: row.module,
    area: row.area,
    dueRule: row.dueRule,
    penalty: row.penalty,
    applies: row.applies,
    ownerRole: row.ownerRole,
    reviewerRole: row.reviewerRole,
    notifyDays: row.notifyDays,
    visibility: (['firm', 'client', 'both'].includes(row.visibility) ? row.visibility : 'firm') as ActivityDto['visibility'],
    note: row.note,
    confirm: isFirmWideAdmin(role) ? (row.confirm ?? null) : null,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    from: row.source === 'manual' ? 'manual' : 'master',
  };
}

let seeded = false;

/** SYSTEM: insert the master rows that are missing and link obligations without an activity. */
export async function systemEnsureActivitiesSeeded(): Promise<{ activities: number; links: number }> {
  if (seeded) return { activities: 0, links: 0 };
  await db
    .insert(complianceActivities)
    .values(
      ACTIVITY_SEED.map((a, i) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        activityGroup: a.group,
        frequency: a.frequency,
        module: a.module,
        area: a.area,
        dueRule: a.dueRule,
        penalty: a.penalty,
        applies: a.applies,
        ownerRole: a.ownerRole,
        reviewerRole: a.reviewerRole,
        notifyDays: a.notifyDays,
        visibility: a.visibility,
        note: a.note,
        confirm: a.confirm ?? null,
        source: a.from,
        sort: i + 1,
      })),
    )
    .onConflictDoNothing();
  let links = 0;
  for (const [obligationId, activityId] of Object.entries(OBLIGATION_ACTIVITY)) {
    const rows = await db
      .update(complianceObligations)
      .set({ activityId })
      .where(and(eq(complianceObligations.id, obligationId), isNull(complianceObligations.activityId)))
      .returning({ id: complianceObligations.id });
    links += rows.length;
  }
  seeded = true;
  return { activities: ACTIVITY_SEED.length, links };
}

/** SYSTEM: every activity row by id (for the reminder job and the detail builders). */
export async function systemActivityMap(): Promise<Map<string, ActivityRow>> {
  const rows = await db.select().from(complianceActivities);
  return new Map(rows.map((r) => [r.id, r]));
}

export async function listActivities(ctx: AuthContext, opts: { group?: 'statutory' | 'non-statutory' } = {}): Promise<ActivityDto[]> {
  if (!READERS.has(ctx.role)) return [];
  await systemEnsureActivitiesSeeded();
  const rows = await db
    .select()
    .from(complianceActivities)
    .where(opts.group ? eq(complianceActivities.activityGroup, opts.group) : undefined)
    .orderBy(asc(complianceActivities.sort), asc(complianceActivities.id));
  return rows.map((r) => toActivityDto(r, ctx.role));
}

export async function getActivityRow(id: string): Promise<ActivityRow | null> {
  const [row] = await db.select().from(complianceActivities).where(eq(complianceActivities.id, id)).limit(1);
  return row ?? null;
}

export interface ActivityPatch {
  notifyDays?: number;
  ownerRole?: string;
  reviewerRole?: string;
  visibility?: 'firm' | 'client' | 'both';
  confirmed?: boolean;
}

export async function updateActivity(ctx: AuthContext, id: string, patch: ActivityPatch): Promise<ActivityDto> {
  if (!isFirmWideAdmin(ctx.role)) throw new ActivityError(403, 'forbidden');
  await systemEnsureActivitiesSeeded();
  const row = await getActivityRow(id);
  if (!row) throw new ActivityError(404, 'not_found');
  const set: Partial<typeof complianceActivities.$inferInsert> = { updatedBy: ctx.userId, updatedAt: new Date() };
  if (patch.notifyDays !== undefined) set.notifyDays = patch.notifyDays;
  if (patch.ownerRole !== undefined) set.ownerRole = patch.ownerRole.trim().slice(0, 120);
  if (patch.reviewerRole !== undefined) set.reviewerRole = patch.reviewerRole.trim().slice(0, 120);
  if (patch.visibility !== undefined) {
    // Statutory items are always visible to both (COMPLIANCE-MODEL 3.2).
    if (row.activityGroup === 'statutory' && patch.visibility !== 'both') throw new ActivityError(400, 'statutory_is_both');
    set.visibility = patch.visibility;
  }
  if (patch.confirmed !== undefined) {
    set.confirmedAt = patch.confirmed ? new Date() : null;
    set.confirmedBy = patch.confirmed ? ctx.userId : null;
  }
  const [updated] = await db.update(complianceActivities).set(set).where(eq(complianceActivities.id, row.id)).returning();
  await recordAuditEvent(ctx, {
    action: 'compliance.activity.update',
    summary: `Activity ${row.id} changed`,
    metadata: { id: row.id, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) },
  });
  return toActivityDto(updated ?? row, ctx.role);
}
