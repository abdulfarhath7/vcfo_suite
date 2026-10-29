import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, workSessions } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { resolveWorkItem } from '@/db/repositories/work-items';
import { canUseWorkTools } from '@/lib/work/work-access';
import { totalSessionMs, type ItemSessionsPayload, type WorkSessionDto } from '@/lib/work/sessions';

/**
 * WORK SESSIONS — the task drawer timer (G-16), table `work_sessions`.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   read  — everyone who can resolve the item (`resolveWorkItem`: a lead on the
 *           engagements they lead, a manager on theirs, admins on all) sees every
 *           session on that item and its total time.
 *   write — a person starts and stops only their own sessions, on an item they can
 *           resolve. Starting a session stops that person's running one first, so
 *           each person has at most one running session.
 *   client / developer — nothing.
 */

type Row = typeof workSessions.$inferSelect;

function toDto(row: Row, userName: string | null): WorkSessionDto {
  return {
    id: row.id,
    itemKey: row.itemKey,
    engagementId: row.engagementId,
    userId: row.userId,
    userName,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    note: row.note,
  };
}

/** Every session on one item, newest first, with the total and the caller's running one. */
export async function listItemSessions(ctx: AuthContext, key: string): Promise<ItemSessionsPayload | null> {
  const item = await resolveWorkItem(ctx, key);
  if (!item) return null;
  const rows = await db
    .select({ session: workSessions, userName: profiles.name })
    .from(workSessions)
    .leftJoin(profiles, eq(profiles.id, workSessions.userId))
    .where(eq(workSessions.itemKey, item.key))
    .orderBy(desc(workSessions.startedAt))
    .limit(500);
  const sessions = rows.map((r) => toDto(r.session, r.userName));
  return {
    sessions: sessions.slice(0, 50),
    totalMs: totalSessionMs(sessions, Date.now()),
    running: sessions.find((s) => s.userId === ctx.userId && !s.endedAt) ?? null,
  };
}

/** The caller's running session on any item, or null. */
export async function getRunningSession(ctx: AuthContext): Promise<WorkSessionDto | null> {
  if (!canUseWorkTools(ctx.role)) return null;
  const [row] = await db
    .select()
    .from(workSessions)
    .where(and(eq(workSessions.userId, ctx.userId), isNull(workSessions.endedAt)))
    .orderBy(desc(workSessions.startedAt))
    .limit(1);
  return row ? toDto(row, ctx.name ?? null) : null;
}

/** Start a session on an item for the caller; their running session (any item) stops first. */
export async function startSession(
  ctx: AuthContext,
  key: string,
  note?: string | null,
): Promise<WorkSessionDto | null> {
  const item = await resolveWorkItem(ctx, key);
  if (!item) return null;
  const now = new Date();
  await db
    .update(workSessions)
    .set({ endedAt: now })
    .where(and(eq(workSessions.userId, ctx.userId), isNull(workSessions.endedAt)));
  const [row] = await db
    .insert(workSessions)
    .values({
      itemKey: item.key,
      engagementId: item.engagementId,
      userId: ctx.userId,
      startedAt: now,
      note: note?.trim() || null,
    })
    .returning();
  if (!row) return null;
  void recordAuditEvent(ctx, {
    engagementId: item.engagementId,
    action: 'work.session.started',
    summary: 'Work session started',
    metadata: { itemKey: item.key, sessionId: row.id },
  });
  return toDto(row, ctx.name ?? null);
}

/** Stop one of the caller's own running sessions. Another person's session reads as null. */
export async function stopSession(
  ctx: AuthContext,
  sessionId: string,
  note?: string | null,
): Promise<WorkSessionDto | null> {
  if (!canUseWorkTools(ctx.role)) return null;
  const [row] = await db
    .update(workSessions)
    .set({ endedAt: new Date(), ...(note !== undefined ? { note: note?.trim() || null } : {}) })
    .where(
      and(eq(workSessions.id, sessionId), eq(workSessions.userId, ctx.userId), isNull(workSessions.endedAt)),
    )
    .returning();
  if (!row) return null;
  void recordAuditEvent(ctx, {
    engagementId: row.engagementId,
    action: 'work.session.stopped',
    summary: 'Work session stopped',
    metadata: { itemKey: row.itemKey, sessionId: row.id },
  });
  return toDto(row, ctx.name ?? null);
}
