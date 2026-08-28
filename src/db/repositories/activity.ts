import 'server-only';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { activity, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { ActivityEvent } from '@/data/engagements';
import {
  assertEngagementAccess,
  listScopedEngagementIds,
} from '@/db/repositories/engagements';
import { LEGACY_ENGAGEMENT_IDS } from '@/lib/legacy-engagement-ids';

/**
 * ACTIVITY REPOSITORY — replaces vcfo.activity localStorage.
 *
 * Access: admin all; manager via owned engagements; intern/client via scoped
 * engagements (plus global rows with null engagement_id for admin/manager).
 */

type Row = typeof activity.$inferSelect;

function appEngagementId(dbId: string | null): string | undefined {
  if (!dbId) return undefined;
  return LEGACY_ENGAGEMENT_IDS[dbId] ?? dbId;
}

function formatRelativeAt(createdAt: Date): string {
  const ms = Date.now() - createdAt.getTime();
  if (ms < 60_000) return 'Just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return createdAt.toISOString().slice(0, 10);
}

export function toAppActivity(
  row: Row,
  actorName: string | null,
): ActivityEvent {
  return {
    id: row.id,
    engagementId: appEngagementId(row.engagementId),
    actor: actorName?.trim() || row.actorId || 'system',
    verb: row.kind,
    target: row.message || undefined,
    at: formatRelativeAt(row.createdAt),
  };
}

async function scopedEngagementIds(ctx: AuthContext): Promise<string[] | 'all'> {
  if (ctx.role === 'admin') return 'all';
  return listScopedEngagementIds(ctx);
}

export async function listActivity(ctx: AuthContext, limit = 100): Promise<ActivityEvent[]> {
  const scope = await scopedEngagementIds(ctx);
  if (scope !== 'all' && scope.length === 0) return [];

  const capped = Math.min(Math.max(limit, 1), 500);
  const rows =
    scope === 'all'
      ? await db
          .select({
            event: activity,
            actorName: profiles.name,
          })
          .from(activity)
          .leftJoin(profiles, eq(profiles.id, activity.actorId))
          .orderBy(desc(activity.createdAt))
          .limit(capped)
      : await db
          .select({
            event: activity,
            actorName: profiles.name,
          })
          .from(activity)
          .leftJoin(profiles, eq(profiles.id, activity.actorId))
          .where(inArray(activity.engagementId, scope))
          .orderBy(desc(activity.createdAt))
          .limit(capped);

  return rows.map((r) => toAppActivity(r.event, r.actorName));
}

export interface CreateActivityInput {
  engagementId?: string;
  actor?: string;
  verb: string;
  target?: string;
}

export async function createActivity(
  ctx: AuthContext,
  input: CreateActivityInput,
): Promise<ActivityEvent> {
  let dbEngagementId: string | null = null;
  if (input.engagementId) {
    const access = await assertEngagementAccess(ctx, input.engagementId);
    if (!access.ok) throw new Error('Engagement not found or not permitted');
    dbEngagementId = access.dbId;
  } else if (ctx.role !== 'admin' && ctx.role !== 'manager') {
    throw new Error('Engagement required');
  }

  const [row] = await db
    .insert(activity)
    .values({
      engagementId: dbEngagementId,
      actorId: ctx.userId,
      kind: input.verb,
      message: input.target ?? input.actor ?? '',
    })
    .returning();

  return toAppActivity(row, input.actor ?? ctx.name);
}
