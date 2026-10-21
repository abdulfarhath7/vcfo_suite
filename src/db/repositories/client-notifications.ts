import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { notifications } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';

/**
 * CLIENT NOTIFICATIONS (client portal v7) — the bits the Notifications page
 * needs on top of `notifications.ts`: mark unread (Undo of "Mark all read" /
 * of a single read) and a "mark all read" that returns the ids it changed so
 * the page can undo exactly that set.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Own rows only: every statement is keyed by `user_id = ctx.userId`; ids that
 * belong to someone else are silently ignored.
 */

const UUID = /^[0-9a-f-]{36}$/i;

export async function markNotificationsUnread(ctx: AuthContext, ids: string[]): Promise<number> {
  const clean = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, 500);
  if (!clean.length) return 0;
  const rows = await db
    .update(notifications)
    .set({ status: 'unread' })
    .where(and(eq(notifications.userId, ctx.userId), inArray(notifications.id, clean)))
    .returning({ id: notifications.id });
  return rows.length;
}

export async function markNotificationsReadByIds(ctx: AuthContext, ids: string[]): Promise<string[]> {
  const clean = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, 500);
  if (!clean.length) return [];
  const rows = await db
    .update(notifications)
    .set({ status: 'read' })
    .where(and(eq(notifications.userId, ctx.userId), inArray(notifications.id, clean), eq(notifications.status, 'unread')))
    .returning({ id: notifications.id });
  return rows.map((r) => r.id);
}

/** Every unread row of the caller (inbox and history) → read; returns the changed ids. */
export async function markAllNotificationsReadReturningIds(ctx: AuthContext): Promise<string[]> {
  const rows = await db
    .update(notifications)
    .set({ status: 'read' })
    .where(and(eq(notifications.userId, ctx.userId), eq(notifications.status, 'unread')))
    .returning({ id: notifications.id });
  return rows.map((r) => r.id);
}
