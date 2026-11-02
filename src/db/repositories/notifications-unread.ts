import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { notifications } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';

/**
 * Put the caller's own notifications back to unread — the console's "Mark
 * unread" in the Notifications reader and the Undo after "Mark all read".
 * Path A: `user_id = ctx.userId` for every role; other users' ids are ignored.
 */
export async function markNotificationsUnread(ctx: AuthContext, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(notifications)
    .set({ status: 'unread' })
    .where(and(eq(notifications.userId, ctx.userId), inArray(notifications.id, ids)))
    .returning({ id: notifications.id });
  return rows.length;
}
