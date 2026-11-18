import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { cleanSignName } from '@/lib/receivables/sign-name';

/**
 * The caller's own email sign name (owner, 18 Nov 2026): typed once in an email pop-up, kept on
 * their profile until they change it, and used for "Regards, <name>" in every receivables email
 * they send, the automatic ones included. Only the caller's own row is read or written.
 */
export async function getSignName(ctx: AuthContext): Promise<string> {
  const [row] = await db.select({ sign: profiles.emailSignName, name: profiles.name }).from(profiles).where(eq(profiles.id, ctx.userId)).limit(1);
  return row?.sign?.trim() || row?.name?.trim() || ctx.name || 'SBC';
}

export async function setSignName(ctx: AuthContext, value: unknown): Promise<string> {
  await db.update(profiles).set({ emailSignName: cleanSignName(value) }).where(eq(profiles.id, ctx.userId));
  return getSignName(ctx);
}
