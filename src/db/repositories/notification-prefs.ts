import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientAccountMeta, notificationPrefs } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import {
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefsPatch,
  type NotificationPrefs,
  type NotificationPrefsPatch,
} from '@/lib/client-portal/notification-prefs';

/**
 * NOTIFICATION PREFS + ACCOUNT META (client portal v7 — Settings page).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Owner only: every read and write is keyed by `ctx.userId`; no
 * caller-supplied profile id exists. Locked email categories (docs, steps,
 * deadlines, timeline) are not stored at all — they are always on, and a
 * patch cannot switch them off (`normalizeNotificationPrefsPatch`).
 */

type Row = typeof notificationPrefs.$inferSelect;

function toPrefs(row: Row | undefined): NotificationPrefs {
  const d = DEFAULT_NOTIFICATION_PREFS;
  if (!row) return { ...d, email: { ...d.email }, whatsapp: { ...d.whatsapp } };
  const em = row.email ?? {};
  const wa = row.whatsapp ?? {};
  const pick = <T extends Record<string, boolean>>(def: T, src: Record<string, boolean>): T => {
    const out = { ...def };
    for (const k of Object.keys(def) as Array<keyof T>) {
      const v = src[k as string];
      if (typeof v === 'boolean') (out as Record<string, boolean>)[k as string] = v;
    }
    return out;
  };
  return {
    email: pick(d.email, em),
    whatsapp: pick(d.whatsapp, wa),
    quietHours: row.quietHours,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
  };
}

export async function getOwnNotificationPrefs(ctx: AuthContext): Promise<NotificationPrefs> {
  const [row] = await db.select().from(notificationPrefs).where(eq(notificationPrefs.profileId, ctx.userId)).limit(1);
  return toPrefs(row);
}

export async function updateOwnNotificationPrefs(
  ctx: AuthContext,
  patch: NotificationPrefsPatch,
): Promise<NotificationPrefs> {
  const clean = normalizeNotificationPrefsPatch(patch);
  const current = await getOwnNotificationPrefs(ctx);
  const next: NotificationPrefs = {
    ...current,
    email: { ...current.email, ...(clean.email ?? {}) },
    whatsapp: { ...current.whatsapp, ...(clean.whatsapp ?? {}) },
    quietHours: clean.quietHours ?? current.quietHours,
  };
  const now = new Date();
  await db
    .insert(notificationPrefs)
    .values({
      profileId: ctx.userId,
      email: next.email,
      whatsapp: next.whatsapp,
      quietHours: next.quietHours,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: notificationPrefs.profileId,
      set: { email: next.email, whatsapp: next.whatsapp, quietHours: next.quietHours, updatedAt: now },
    });
  return next;
}

/** When the caller last changed their password (null = never through the portal). */
export async function getOwnPasswordChangedAt(ctx: AuthContext): Promise<string | null> {
  const [row] = await db
    .select({ at: clientAccountMeta.passwordChangedAt })
    .from(clientAccountMeta)
    .where(eq(clientAccountMeta.profileId, ctx.userId))
    .limit(1);
  return row?.at ? row.at.toISOString() : null;
}

export async function stampOwnPasswordChanged(ctx: AuthContext): Promise<string> {
  const now = new Date();
  await db
    .insert(clientAccountMeta)
    .values({ profileId: ctx.userId, passwordChangedAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: clientAccountMeta.profileId, set: { passwordChangedAt: now, updatedAt: now } });
  return now.toISOString();
}
