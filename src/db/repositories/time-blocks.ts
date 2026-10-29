import 'server-only';
import { and, asc, eq, gt, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { timeBlocks } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { listScopedEngagementIds } from '@/db/repositories/engagements';
import { resolveWorkItem } from '@/db/repositories/work-items';
import { canUseWorkTools } from '@/lib/work/work-access';
import { isValidBlockRange, timeRangeLabel, type PlannerBlock } from '@/lib/work/planner';

/**
 * TIME BLOCKS — planned time on a person's own calendar (Plan my week, G-17), table
 * `time_blocks`.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   Every read and write is the caller's own rows (`user_id = ctx.userId`).
 *   A block tied to an item needs an item the caller can resolve
 *   (`resolveWorkItem`: lead on the engagements they lead, manager on theirs, admins
 *   on all). A list hides blocks on engagements that left the caller's scope.
 *   client / developer — nothing.
 */

export const BLOCK_TITLE_MAX = 200;
const MAX_BLOCKS_PER_CALL = 40;
const MAX_RANGE_DAYS = 45;

type Row = typeof timeBlocks.$inferSelect;

function toDto(row: Row): PlannerBlock {
  return {
    id: row.id,
    itemKey: row.itemKey,
    engagementId: row.engagementId,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
  };
}

export interface TimeBlockInput {
  itemKey?: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
}

/** The caller's blocks that overlap [from, to). */
export async function listTimeBlocks(
  ctx: AuthContext,
  range: { from: string; to: string },
): Promise<PlannerBlock[]> {
  if (!canUseWorkTools(ctx.role)) return [];
  const from = new Date(range.from);
  const to = new Date(range.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new Error('invalid_range');
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) throw new Error('invalid_range');

  const conds = [eq(timeBlocks.userId, ctx.userId), lt(timeBlocks.startsAt, to), gt(timeBlocks.endsAt, from)];
  if (!isFirmWideAdmin(ctx.role)) {
    const ids = await listScopedEngagementIds(ctx);
    conds.push(ids.length > 0 ? or(isNull(timeBlocks.engagementId), inArray(timeBlocks.engagementId, ids))! : isNull(timeBlocks.engagementId));
  }
  const rows = await db
    .select()
    .from(timeBlocks)
    .where(and(...conds))
    .orderBy(asc(timeBlocks.startsAt));
  return rows.map(toDto);
}

async function itemFields(
  ctx: AuthContext,
  key: string | null | undefined,
): Promise<{ itemKey: string | null; engagementId: string | null } | null> {
  if (!key) return { itemKey: null, engagementId: null };
  const item = await resolveWorkItem(ctx, key);
  return item ? { itemKey: item.key, engagementId: item.engagementId } : null;
}

function cleanTitle(title: string): string {
  const text = title.trim().slice(0, BLOCK_TITLE_MAX);
  if (!text) throw new Error('invalid_title');
  return text;
}

/** Create one or more blocks for the caller. A block on an item outside the scope fails the call. */
export async function createTimeBlocks(ctx: AuthContext, inputs: TimeBlockInput[]): Promise<PlannerBlock[] | null> {
  if (!canUseWorkTools(ctx.role)) return null;
  if (inputs.length === 0 || inputs.length > MAX_BLOCKS_PER_CALL) throw new Error('invalid_count');
  const values: Array<typeof timeBlocks.$inferInsert> = [];
  for (const input of inputs) {
    if (!isValidBlockRange(input.startsAt, input.endsAt)) throw new Error('invalid_range');
    const item = await itemFields(ctx, input.itemKey);
    if (!item) return null;
    values.push({
      userId: ctx.userId,
      itemKey: item.itemKey,
      engagementId: item.engagementId,
      title: cleanTitle(input.title),
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    });
  }
  const rows = await db.insert(timeBlocks).values(values).returning();
  for (const row of rows) {
    void recordAuditEvent(ctx, {
      engagementId: row.engagementId,
      action: 'work.block.created',
      summary: `Time block planned: ${row.title} · ${timeRangeLabel(row.startsAt.toISOString(), row.endsAt.toISOString())}`,
      metadata: { itemKey: row.itemKey, blockId: row.id },
    });
  }
  return rows.map(toDto);
}

async function ownRow(ctx: AuthContext, id: string): Promise<Row | null> {
  if (!canUseWorkTools(ctx.role)) return null;
  const [row] = await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, ctx.userId)))
    .limit(1);
  return row ?? null;
}

/** Move or resize (new times) or rename one of the caller's blocks. */
export async function updateTimeBlock(
  ctx: AuthContext,
  id: string,
  patch: { title?: string; startsAt?: string; endsAt?: string; itemKey?: string | null },
): Promise<PlannerBlock | null> {
  const row = await ownRow(ctx, id);
  if (!row) return null;
  const startsAt = patch.startsAt ?? row.startsAt.toISOString();
  const endsAt = patch.endsAt ?? row.endsAt.toISOString();
  if (!isValidBlockRange(startsAt, endsAt)) throw new Error('invalid_range');
  let item: { itemKey: string | null; engagementId: string | null } | null = {
    itemKey: row.itemKey,
    engagementId: row.engagementId,
  };
  if (patch.itemKey !== undefined) {
    item = await itemFields(ctx, patch.itemKey);
    if (!item) return null;
  }
  const [updated] = await db
    .update(timeBlocks)
    .set({
      ...(patch.title !== undefined ? { title: cleanTitle(patch.title) } : {}),
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      itemKey: item.itemKey,
      engagementId: item.engagementId,
    })
    .where(and(eq(timeBlocks.id, row.id), eq(timeBlocks.userId, ctx.userId)))
    .returning();
  if (!updated) return null;
  void recordAuditEvent(ctx, {
    engagementId: updated.engagementId,
    action: 'work.block.updated',
    summary: `Time block moved: ${updated.title} · ${timeRangeLabel(updated.startsAt.toISOString(), updated.endsAt.toISOString())}`,
    metadata: { itemKey: updated.itemKey, blockId: updated.id },
  });
  return toDto(updated);
}

export async function deleteTimeBlock(ctx: AuthContext, id: string): Promise<boolean> {
  const row = await ownRow(ctx, id);
  if (!row) return false;
  await db.delete(timeBlocks).where(and(eq(timeBlocks.id, row.id), eq(timeBlocks.userId, ctx.userId)));
  void recordAuditEvent(ctx, {
    engagementId: row.engagementId,
    action: 'work.block.deleted',
    summary: `Time block removed: ${row.title}`,
    metadata: { itemKey: row.itemKey, blockId: row.id },
  });
  return true;
}
