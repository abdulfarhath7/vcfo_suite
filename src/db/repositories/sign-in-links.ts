import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, signInLinks } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';

/**
 * SIGN-IN LINKS (S-650) — a staff profile's link to an outside sign-in, today Microsoft Entra ID.
 *
 * Microsoft sign-in NEVER creates a profile. The first Microsoft sign-in whose email matches an
 * existing, active staff profile makes the link; later sign-ins match the link by the provider's
 * stable subject first. A profile already linked to a different Microsoft subject is refused, as
 * is a client, the developer role, an inactive profile, a lead without a scoping id, and a
 * profile with two-step sign-in on (the Microsoft flow cannot ask for the app code).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Owner only. `getOwnSignInLink` and `removeOwnSignInLink` are keyed by `ctx.userId`.
 * `systemResolveExternalSignIn` is the documented deviation for the auth layer (like
 * `systemCheckSignInPassword`): it runs inside sign-in before an AuthContext exists.
 */

export const MICROSOFT_PROVIDER_ID = 'microsoft-entra-id';

const LINKABLE_ROLES = new Set(['super_admin', 'admin', 'manager', 'intern']);

export interface ExternalSignInProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  internId: string | null;
  clientId: string | null;
  avatarObjectKey: string | null;
  updatedAt: Date;
}

export type ExternalSignInRefusal = 'no_profile' | 'not_allowed' | 'linked_elsewhere' | 'two_step_on';

export interface SignInLinkView {
  provider: string;
  email: string;
  linkedAt: string;
  lastUsedAt: string | null;
}

const profileColumns = {
  id: profiles.id,
  email: profiles.email,
  name: profiles.name,
  role: profiles.role,
  internId: profiles.internId,
  clientId: profiles.clientId,
  status: profiles.status,
  avatarObjectKey: profiles.avatarObjectKey,
  updatedAt: profiles.updatedAt,
  totpEnabledAt: profiles.totpEnabledAt,
  totpSecretEnc: profiles.totpSecretEnc,
};

/**
 * Finds the profile an outside identity signs in as. With `link`, makes or touches the link row.
 * Returns the profile, or why it was refused.
 */
export async function systemResolveExternalSignIn(input: {
  provider: string;
  subject: string;
  email: string | null | undefined;
  link: boolean;
}): Promise<{ ok: true; profile: ExternalSignInProfile } | { ok: false; reason: ExternalSignInRefusal }> {
  const subject = input.subject.trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  if (!subject) return { ok: false, reason: 'no_profile' };

  const [byLink] = await db
    .select({ profileId: signInLinks.profileId })
    .from(signInLinks)
    .where(and(eq(signInLinks.provider, input.provider), eq(signInLinks.subject, subject)))
    .limit(1);

  let row;
  if (byLink) {
    [row] = await db.select(profileColumns).from(profiles).where(eq(profiles.id, byLink.profileId)).limit(1);
  } else {
    if (!email) return { ok: false, reason: 'no_profile' };
    [row] = await db.select(profileColumns).from(profiles).where(eq(profiles.email, email)).limit(1);
  }
  if (!row) return { ok: false, reason: 'no_profile' };
  if (row.status !== 'active' || !LINKABLE_ROLES.has(row.role)) return { ok: false, reason: 'not_allowed' };
  if (row.role === 'intern' && !row.internId?.trim()) return { ok: false, reason: 'not_allowed' };
  if (row.totpEnabledAt && row.totpSecretEnc) return { ok: false, reason: 'two_step_on' };

  if (!byLink) {
    // The profile may already be linked to a different Microsoft identity.
    const [existing] = await db
      .select({ subject: signInLinks.subject })
      .from(signInLinks)
      .where(and(eq(signInLinks.profileId, row.id), eq(signInLinks.provider, input.provider)))
      .limit(1);
    if (existing && existing.subject !== subject) return { ok: false, reason: 'linked_elsewhere' };
  }

  if (input.link) {
    const now = new Date();
    if (byLink) {
      await db
        .update(signInLinks)
        .set({ lastUsedAt: now })
        .where(and(eq(signInLinks.provider, input.provider), eq(signInLinks.subject, subject)));
    } else {
      await db
        .insert(signInLinks)
        .values({ profileId: row.id, provider: input.provider, subject, email: email || row.email, lastUsedAt: now })
        .onConflictDoNothing();
      await recordAuditEvent(
        { userId: row.id, email: row.email, name: row.name ?? row.email, role: row.role as AuthContext['role'] },
        {
          action: 'account.sign_in_link',
          summary: 'Microsoft sign-in connected',
          actorEmail: row.email,
          actorName: row.name ?? row.email,
          metadata: { provider: input.provider },
        },
      );
    }
  }

  return {
    ok: true,
    profile: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      internId: row.internId,
      clientId: row.clientId,
      avatarObjectKey: row.avatarObjectKey,
      updatedAt: row.updatedAt,
    },
  };
}

/** The caller's own link for one provider, or null. */
export async function getOwnSignInLink(ctx: AuthContext, provider: string): Promise<SignInLinkView | null> {
  const [row] = await db
    .select()
    .from(signInLinks)
    .where(and(eq(signInLinks.profileId, ctx.userId), eq(signInLinks.provider, provider)))
    .limit(1);
  if (!row) return null;
  return {
    provider: row.provider,
    email: row.email,
    linkedAt: row.linkedAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

/** Removes the caller's own link; the next Microsoft sign-in links again by email. */
export async function removeOwnSignInLink(ctx: AuthContext, provider: string): Promise<boolean> {
  const rows = await db
    .delete(signInLinks)
    .where(and(eq(signInLinks.profileId, ctx.userId), eq(signInLinks.provider, provider)))
    .returning({ id: signInLinks.id });
  if (rows.length > 0) {
    await recordAuditEvent(ctx, {
      action: 'account.sign_in_unlink',
      summary: 'Microsoft sign-in disconnected',
      actorEmail: ctx.email,
      actorName: ctx.name,
      metadata: { provider },
    });
  }
  return rows.length > 0;
}
