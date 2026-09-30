import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { askClientPrefs } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { AskForbiddenError } from '@/lib/ask/access';

/**
 * ASK VCFO CLIENT PREFS (C1). One row per client profile; the owner is the
 * only reader and writer (keyed by `ctx.userId`, never a caller-supplied id).
 */
export type AskClientPrefsRow = typeof askClientPrefs.$inferSelect;

function assertClient(ctx: AuthContext) {
  if (ctx.role !== 'client') throw new AskForbiddenError('Only clients have Ask VCFO preferences');
}

export async function getAskClientPrefs(ctx: AuthContext): Promise<AskClientPrefsRow | null> {
  assertClient(ctx);
  const [row] = await db.select().from(askClientPrefs).where(eq(askClientPrefs.profileId, ctx.userId)).limit(1);
  return row ?? null;
}

export async function markNudgeShown(ctx: AuthContext, at: Date): Promise<void> {
  assertClient(ctx);
  await db
    .insert(askClientPrefs)
    .values({ profileId: ctx.userId, lastNudgeAt: at })
    .onConflictDoUpdate({ target: askClientPrefs.profileId, set: { lastNudgeAt: at } });
}

export async function dismissNudge(ctx: AuthContext, until: Date): Promise<void> {
  assertClient(ctx);
  await db
    .insert(askClientPrefs)
    .values({ profileId: ctx.userId, dismissedUntil: until })
    .onConflictDoUpdate({ target: askClientPrefs.profileId, set: { dismissedUntil: until } });
}
