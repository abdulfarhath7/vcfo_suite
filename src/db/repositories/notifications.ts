import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { notifications } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type {
  AppNotification,
  NotificationKind,
} from '@/lib/checklist-notifications';

/**
 * NOTIFICATIONS REPOSITORY — replaces vcfo.notifications localStorage.
 *
 * Access: each user only sees/updates their own rows (user_id = ctx.userId).
 * Extra AppNotification fields are JSON-encoded in `description` for round-trip.
 */

type Row = typeof notifications.$inferSelect;

type StoredPayload = {
  body?: string;
  kind?: NotificationKind;
  engagementId?: string;
  companyName?: string;
  itemId?: string;
  href?: string;
};

function parsePayload(description: string | null): StoredPayload & { body: string } {
  if (!description) return { body: '' };
  try {
    const parsed = JSON.parse(description) as StoredPayload;
    if (parsed && typeof parsed === 'object' && ('kind' in parsed || 'body' in parsed || 'href' in parsed)) {
      return {
        ...parsed,
        body: typeof parsed.body === 'string' ? parsed.body : '',
      };
    }
  } catch {
    /* plain text body */
  }
  return { body: description };
}

function encodePayload(n: Omit<AppNotification, 'id' | 'read' | 'createdAt'> & { body: string }): string {
  return JSON.stringify({
    body: n.body,
    kind: n.kind,
    engagementId: n.engagementId,
    companyName: n.companyName,
    itemId: n.itemId,
    href: n.href,
  } satisfies StoredPayload);
}

export function toAppNotification(row: Row): AppNotification {
  const payload = parsePayload(row.description);
  return {
    id: row.id,
    kind: payload.kind ?? 'checklist.deliver',
    title: row.title,
    body: payload.body || row.description || '',
    engagementId: payload.engagementId ?? '',
    companyName: payload.companyName ?? '',
    itemId: payload.itemId,
    href: payload.href ?? '#',
    createdAt: row.createdAt.toISOString(),
    read: row.status === 'read',
  };
}

export async function listNotifications(ctx: AuthContext): Promise<AppNotification[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, ctx.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(80);
  return rows.map(toAppNotification);
}

export async function createNotification(
  ctx: AuthContext,
  input: Omit<AppNotification, 'id' | 'read' | 'createdAt'> & { userId?: string },
): Promise<AppNotification> {
  // Admin/manager may create notifications for another user; otherwise force self.
  const userId =
    (ctx.role === 'admin' || ctx.role === 'manager') && input.userId
      ? input.userId
      : ctx.userId;

  const [row] = await db
    .insert(notifications)
    .values({
      userId,
      title: input.title,
      description: encodePayload(input),
      status: 'unread',
    })
    .returning();
  return toAppNotification(row);
}

export async function createNotifications(
  ctx: AuthContext,
  items: Array<Omit<AppNotification, 'id' | 'read' | 'createdAt'>>,
): Promise<AppNotification[]> {
  if (items.length === 0) return [];
  const inserted = await db
    .insert(notifications)
    .values(
      items.map((input) => ({
        userId: ctx.userId,
        title: input.title,
        description: encodePayload(input),
        status: 'unread' as const,
      })),
    )
    .returning();
  return inserted.map(toAppNotification);
}

/**
 * System fan-out: insert notifications for arbitrary user ids after a process event.
 * Call only from server-side notifiers (after the mutation already authorized access).
 */
export async function createNotificationsForUsers(
  items: Array<Omit<AppNotification, 'id' | 'read' | 'createdAt'> & { userId: string }>,
): Promise<AppNotification[]> {
  if (items.length === 0) return [];
  const inserted = await db
    .insert(notifications)
    .values(
      items.map((input) => ({
        userId: input.userId,
        title: input.title,
        description: encodePayload(input),
        status: 'unread' as const,
      })),
    )
    .returning();
  return inserted.map(toAppNotification);
}

export async function markNotificationRead(
  ctx: AuthContext,
  id: string,
): Promise<AppNotification | null> {
  const [row] = await db
    .update(notifications)
    .set({ status: 'read' })
    .where(and(eq(notifications.id, id), eq(notifications.userId, ctx.userId)))
    .returning();
  return row ? toAppNotification(row) : null;
}

export async function markAllNotificationsRead(ctx: AuthContext): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ status: 'read' })
    .where(and(eq(notifications.userId, ctx.userId), eq(notifications.status, 'unread')))
    .returning({ id: notifications.id });
  return rows.length;
}

export async function deleteNotifications(
  ctx: AuthContext,
  ids: string[],
): Promise<AppNotification[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .delete(notifications)
    .where(and(eq(notifications.userId, ctx.userId), inArray(notifications.id, ids)))
    .returning();
  return rows.map(toAppNotification);
}

/** Re-insert rows the user undid, preserving id / read / createdAt. Scoped to self. */
export async function restoreNotifications(
  ctx: AuthContext,
  items: AppNotification[],
): Promise<AppNotification[]> {
  if (items.length === 0) return [];
  const inserted = await db
    .insert(notifications)
    .values(
      items.map((n) => {
        const parsed = Date.parse(n.createdAt);
        return {
          id: n.id,
          userId: ctx.userId,
          title: n.title,
          description: encodePayload(n),
          status: n.read ? ('read' as const) : ('unread' as const),
          createdAt: Number.isNaN(parsed) ? new Date() : new Date(parsed),
        };
      }),
    )
    .returning();
  return inserted.map(toAppNotification);
}
