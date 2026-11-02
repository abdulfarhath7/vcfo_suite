import 'server-only';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { identifierRevealAttempts, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { checklistStateForViewer, checklistStateFromRow } from '@/db/repositories/engagements';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { identifiersFromState } from '@/lib/client/client-overview';
import { CredentialsError, LOCK_MS, MAX_TRIES, resolveAccess } from './access';

/* ------------------------------------------------------------------ */
/* PAN / TAN password reveal (Home › Company IDs, v7p_ids_password)     */
/* ------------------------------------------------------------------ */

export type IdentifierRevealOutcome =
  | { ok: true; value: string }
  | { ok: false; error: 'wrong_password'; triesLeft: number }
  | { ok: false; error: 'locked'; lockedUntil: string }
  | { ok: false; error: 'not_recorded' };

export async function revealIdentifier(
  ctx: AuthContext,
  input: { field: 'pan' | 'tan'; password: string },
): Promise<IdentifierRevealOutcome> {
  if (input.field !== 'pan' && input.field !== 'tan') throw new CredentialsError('invalid_field', 400);
  if (ctx.role !== 'client') throw new CredentialsError('forbidden', 403);
  const acc = await resolveAccess(ctx, null);
  const now = Date.now();
  const [att] = await db.select().from(identifierRevealAttempts).where(eq(identifierRevealAttempts.profileId, ctx.userId)).limit(1);
  if (att?.lockedUntil && att.lockedUntil.getTime() > now) {
    return { ok: false, error: 'locked', lockedUntil: att.lockedUntil.toISOString() };
  }
  const [me] = await db.select({ hash: profiles.passwordHash }).from(profiles).where(eq(profiles.id, ctx.userId)).limit(1);
  const ok = Boolean(me?.hash) && (await bcrypt.compare(String(input.password ?? ''), me!.hash!));
  const label = input.field.toUpperCase();
  if (!ok) {
    const prior = att?.lockedUntil ? 0 : (att?.failures ?? 0);
    const failures = prior + 1;
    const lockedUntil = failures >= MAX_TRIES ? new Date(now + LOCK_MS) : null;
    const values = { failures: lockedUntil ? 0 : failures, lockedUntil, updatedAt: new Date(now) };
    await db
      .insert(identifierRevealAttempts)
      .values({ profileId: ctx.userId, ...values })
      .onConflictDoUpdate({ target: identifierRevealAttempts.profileId, set: values });
    if (lockedUntil) {
      void recordAuditEvent(ctx, {
        engagementId: acc.dbId,
        action: 'identifiers.reveal_locked',
        summary: `entered a wrong password 3 times to show the ${label} · locked for 60 seconds`,
        metadata: { field: input.field },
      });
      return { ok: false, error: 'locked', lockedUntil: lockedUntil.toISOString() };
    }
    return { ok: false, error: 'wrong_password', triesLeft: MAX_TRIES - failures };
  }
  if (att) {
    await db
      .update(identifierRevealAttempts)
      .set({ failures: 0, lockedUntil: null, updatedAt: new Date(now) })
      .where(eq(identifierRevealAttempts.profileId, ctx.userId));
  }
  const state = checklistStateForViewer(ctx, checklistStateFromRow(acc.row));
  const value = identifiersFromState(state as never)[input.field];
  if (!value) return { ok: false, error: 'not_recorded' };
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: 'identifiers.reveal',
    summary: `showed the company ${label} for 60 seconds · password confirmed`,
    metadata: { field: input.field },
  });
  return { ok: true, value };
}
