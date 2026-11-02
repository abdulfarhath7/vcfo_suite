import 'server-only';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { plannerBlocks, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { listBookLeads } from '@/db/repositories/book-leads';
import { isFirmWideAdmin } from '@/lib/auth';
import { LEGACY_ENGAGEMENT_IDS } from '@/lib/projects/legacy-engagement-ids';
import {
  cleanBlockInput,
  cleanBlockPatch,
  isMissingTableError,
  isPlannerDay,
  PLANNER_BATCH_MAX,
  type PlannerBlockDto,
} from '@/lib/planner-blocks';

/**
 * PLANNER BLOCKS REPOSITORY — work sessions on the console calendar.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   intern       their own calendar only (owner = ctx.userId)
 *   manager      their own + their leads': leads who report to them
 *                (profiles.reports_to_manager_id) or lead a client in their
 *                book (listBookLeads → profile ids)
 *   admin/super  everyone
 *   client       refused
 * Reads and writes use the same owner set. A block outside it reads as "not
 * found". A block tied to a client also needs access to that engagement.
 *
 * Until the `planner_blocks` migration runs, reads return [] and writes throw
 * `planner_not_ready` (the route answers 503).
 */

type Row = typeof plannerBlocks.$inferSelect;

function toDto(row: Row): PlannerBlockDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    createdBy: row.createdBy ?? null,
    engagementId: row.engagementId ? (LEGACY_ENGAGEMENT_IDS[row.engagementId] ?? row.engagementId) : null,
    itemRef: row.itemRef ?? null,
    title: row.title,
    day: String(row.day).slice(0, 10),
    startMin: row.startMin,
    endMin: row.endMin,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

/** The calendars the caller may read and write. */
export async function plannerOwnerScope(ctx: AuthContext): Promise<'all' | Set<string>> {
  if (ctx.role === 'client') throw new Error('not_permitted');
  if (isFirmWideAdmin(ctx.role)) return 'all';
  if (ctx.role === 'intern') return new Set([ctx.userId]);
  if (ctx.role !== 'manager') throw new Error('not_permitted');
  const [book, reports] = await Promise.all([
    listBookLeads(ctx),
    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.role, 'intern'), eq(profiles.reportsToManagerId, ctx.userId))),
  ]);
  const ids = new Set<string>([ctx.userId]);
  for (const l of book) if (l.profileId) ids.add(l.profileId);
  for (const r of reports) ids.add(r.id);
  return ids;
}

const allowed = (scope: 'all' | Set<string>, id: string) => scope === 'all' || scope.has(id);

export async function listPlannerBlocks(
  ctx: AuthContext,
  opts: { ownerIds?: string[]; from: string; to: string },
): Promise<PlannerBlockDto[]> {
  if (!isPlannerDay(opts.from) || !isPlannerDay(opts.to)) throw new Error('day_invalid');
  const scope = await plannerOwnerScope(ctx);
  const asked = opts.ownerIds?.length ? [...new Set(opts.ownerIds)] : [ctx.userId];
  const owners = asked.filter((id) => allowed(scope, id));
  if (!owners.length) return [];
  try {
    const rows = await db
      .select()
      .from(plannerBlocks)
      .where(and(inArray(plannerBlocks.ownerId, owners), gte(plannerBlocks.day, opts.from), lte(plannerBlocks.day, opts.to)))
      .orderBy(asc(plannerBlocks.day), asc(plannerBlocks.startMin));
    return rows.map(toDto);
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

export async function createPlannerBlocks(ctx: AuthContext, raw: unknown[]): Promise<PlannerBlockDto[]> {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (raw.length > PLANNER_BATCH_MAX) throw new Error('too_many');
  const scope = await plannerOwnerScope(ctx);
  const inputs = raw.map(cleanBlockInput);
  const engDb = new Map<string, string>();
  for (const input of inputs) {
    const owner = input.ownerId ?? ctx.userId;
    if (!allowed(scope, owner)) throw new Error('not_permitted');
    if (input.engagementId && !engDb.has(input.engagementId)) {
      const access = await assertEngagementAccess(ctx, input.engagementId);
      if (!access.ok) throw new Error('not_permitted');
      engDb.set(input.engagementId, access.dbId);
    }
  }
  try {
    const rows = await db
      .insert(plannerBlocks)
      .values(
        inputs.map((i) => ({
          ownerId: i.ownerId ?? ctx.userId,
          createdBy: ctx.userId,
          engagementId: i.engagementId ? engDb.get(i.engagementId)! : null,
          itemRef: i.itemRef ?? null,
          title: i.title,
          day: i.day,
          startMin: i.startMin,
          endMin: i.endMin,
        })),
      )
      .returning();
    return rows.map(toDto);
  } catch (err) {
    if (isMissingTableError(err)) throw new Error('planner_not_ready', { cause: err });
    throw err;
  }
}

async function loadOwned(ctx: AuthContext, id: string): Promise<Row | null> {
  const scope = await plannerOwnerScope(ctx);
  try {
    const [row] = await db.select().from(plannerBlocks).where(eq(plannerBlocks.id, id)).limit(1);
    if (!row || !allowed(scope, row.ownerId)) return null;
    return row;
  } catch (err) {
    if (isMissingTableError(err)) throw new Error('planner_not_ready', { cause: err });
    throw err;
  }
}

export async function updatePlannerBlock(ctx: AuthContext, id: string, raw: unknown): Promise<PlannerBlockDto | null> {
  const row = await loadOwned(ctx, id);
  if (!row) return null;
  const next = cleanBlockPatch(raw, { day: String(row.day).slice(0, 10), startMin: row.startMin, endMin: row.endMin, title: row.title });
  const [updated] = await db
    .update(plannerBlocks)
    .set({ ...next, updatedAt: new Date() })
    .where(eq(plannerBlocks.id, id))
    .returning();
  return updated ? toDto(updated) : null;
}

export async function deletePlannerBlock(ctx: AuthContext, id: string): Promise<boolean> {
  const row = await loadOwned(ctx, id);
  if (!row) return false;
  await db.delete(plannerBlocks).where(eq(plannerBlocks.id, id));
  return true;
}
