import 'server-only';

import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementClients, engagements, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { isFirmWideAdmin } from '@/lib/auth';
import { LEGACY_ENGAGEMENT_IDS } from '@/lib/legacy-engagement-ids';
import bcrypt from 'bcryptjs';
import { recordAuditEvent } from '@/db/repositories/audit-events';

export type EngagementClientMember = {
  userId: string;
  email: string;
  name: string;
  memberRole: 'owner' | 'member';
  invitedBy: string | null;
  createdAt: string;
};

function appEngagementId(dbId: string): string {
  return LEGACY_ENGAGEMENT_IDS[dbId] ?? dbId;
}

function generateClientId(): string {
  return `c${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

/** Engagement DB ids the user may access as a client collaborator. */
export async function listClientMemberEngagementIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ engagementId: engagementClients.engagementId })
    .from(engagementClients)
    .where(eq(engagementClients.userId, userId));
  return rows.map((r) => r.engagementId);
}

export async function ensureEngagementClientMember(input: {
  engagementDbId: string;
  userId: string;
  memberRole?: 'owner' | 'member';
  invitedBy?: string | null;
}): Promise<void> {
  await db
    .insert(engagementClients)
    .values({
      engagementId: input.engagementDbId,
      userId: input.userId,
      memberRole: input.memberRole ?? 'member',
      invitedBy: input.invitedBy ?? null,
    })
    .onConflictDoNothing({
      target: [engagementClients.engagementId, engagementClients.userId],
    });
}

export async function listEngagementClients(
  ctx: AuthContext,
  appOrDbEngagementId: string,
): Promise<EngagementClientMember[]> {
  const access = await assertEngagementAccess(ctx, appOrDbEngagementId);
  if (!access.ok) {
    throw new Error('Engagement not found or not permitted');
  }

  const rows = await db
    .select({
      userId: engagementClients.userId,
      memberRole: engagementClients.memberRole,
      invitedBy: engagementClients.invitedBy,
      createdAt: engagementClients.createdAt,
      email: profiles.email,
      name: profiles.name,
    })
    .from(engagementClients)
    .innerJoin(profiles, eq(profiles.id, engagementClients.userId))
    .where(eq(engagementClients.engagementId, access.dbId))
    .orderBy(asc(engagementClients.createdAt));

  return rows.map((r) => ({
    userId: r.userId,
    email: r.email,
    name: r.name?.trim() || r.email,
    memberRole: r.memberRole === 'owner' ? 'owner' : 'member',
    invitedBy: r.invitedBy,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface InviteEngagementClientInput {
  engagementId: string;
  email: string;
  fullName?: string;
  password: string;
}

export interface InviteEngagementClientResult {
  userId: string;
  email: string;
  name: string;
  tempPassword: string;
  createdNewUser: boolean;
}

/**
 * Client (or staff) adds another client user to the same engagement.
 * New users share the engagement's clientId org key.
 */
export async function inviteEngagementClient(
  ctx: AuthContext,
  input: InviteEngagementClientInput,
): Promise<InviteEngagementClientResult> {
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) {
    throw new Error('Engagement not found or not permitted');
  }

  const canInvite =
    ctx.role === 'client' ||
    ctx.role === 'intern' ||
    ctx.role === 'manager' ||
    isFirmWideAdmin(ctx.role);
  if (!canInvite) {
    throw new Error('Not permitted to invite clients');
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('invalid_email');
  }
  const password = input.password.trim();
  if (password.length < 8) {
    throw new Error('password_too_short');
  }

  const [eng] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, access.dbId))
    .limit(1);
  if (!eng) throw new Error('Engagement not found or not permitted');

  const orgClientId = eng.clientId || generateClientId();
  const name = input.fullName?.trim() || email.split('@')[0] || 'Client';

  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  let userId: string;
  let createdNewUser = false;

  if (existing) {
    if (existing.role !== 'client') {
      throw new Error('email_not_a_client');
    }
    userId = existing.id;
    // Ensure they share org client id when joining this project.
    if (!existing.clientId && orgClientId) {
      await db
        .update(profiles)
        .set({ clientId: orgClientId, updatedAt: new Date() })
        .where(eq(profiles.id, existing.id));
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    const [row] = await db
      .insert(profiles)
      .values({
        email,
        passwordHash,
        name,
        role: 'client',
        status: 'active',
        clientId: orgClientId,
      })
      .returning({ id: profiles.id });
    userId = row.id;
    createdNewUser = true;
  }

  const already = await db
    .select({ id: engagementClients.id })
    .from(engagementClients)
    .where(
      and(
        eq(engagementClients.engagementId, access.dbId),
        eq(engagementClients.userId, userId),
      ),
    )
    .limit(1);

  if (already.length > 0) {
    throw new Error('already_a_member');
  }

  // Also treat primary owner pointer as member if inviting someone new while
  // owner row might be missing — ensure owner exists first.
  if (eng.clientUserId) {
    await ensureEngagementClientMember({
      engagementDbId: access.dbId,
      userId: eng.clientUserId,
      memberRole: 'owner',
    });
  }

  await ensureEngagementClientMember({
    engagementDbId: access.dbId,
    userId,
    memberRole: 'member',
    invitedBy: ctx.userId,
  });

  await recordAuditEvent(ctx, {
    engagementId: appEngagementId(access.dbId),
    action: 'client.invite',
    summary: `Invited client ${email} to project`,
    actorEmail: ctx.email,
    actorName: ctx.name,
    metadata: { invitedUserId: userId, createdNewUser },
  });

  return {
    userId,
    email,
    name: existing?.name?.trim() || name,
    tempPassword: password,
    createdNewUser,
  };
}

export interface SubstituteEngagementClientInput {
  engagementId: string;
  /** Existing member to remove (self or another client on this project). */
  replaceUserId: string;
  email: string;
  fullName?: string;
  password: string;
}

export interface SubstituteEngagementClientResult {
  replacedUserId: string;
  replacedEmail: string;
  replacedName: string;
  userId: string;
  email: string;
  name: string;
  tempPassword: string;
  createdNewUser: boolean;
  memberRole: 'owner' | 'member';
  becamePrimary: boolean;
  /** True when the actor replaced themselves and no longer has access. */
  actorLostAccess: boolean;
  companyName: string;
}

/**
 * Replace one client on a project with another person (new or existing client account).
 * - Any client member may substitute themselves or another client on the same project.
 * - Staff / firm admins with access may also substitute.
 * - The replacement inherits the outgoing member's role; if they were primary
 *   (`engagements.client_user_id`), the pointer moves to the new user.
 */
export async function substituteEngagementClient(
  ctx: AuthContext,
  input: SubstituteEngagementClientInput,
): Promise<SubstituteEngagementClientResult> {
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) {
    throw new Error('Engagement not found or not permitted');
  }

  const canSubstitute =
    ctx.role === 'client' ||
    ctx.role === 'intern' ||
    ctx.role === 'manager' ||
    isFirmWideAdmin(ctx.role);
  if (!canSubstitute) {
    throw new Error('Not permitted to substitute clients');
  }

  const replaceUserId = input.replaceUserId.trim();
  if (!replaceUserId) throw new Error('missing_replace_user');

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('invalid_email');
  const password = input.password.trim();
  if (password.length < 8) throw new Error('password_too_short');

  const [eng] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, access.dbId))
    .limit(1);
  if (!eng) throw new Error('Engagement not found or not permitted');

  // Ensure primary pointer has a membership row before resolving roles.
  if (eng.clientUserId) {
    await ensureEngagementClientMember({
      engagementDbId: access.dbId,
      userId: eng.clientUserId,
      memberRole: 'owner',
    });
  }

  const members = await db
    .select({
      userId: engagementClients.userId,
      memberRole: engagementClients.memberRole,
      email: profiles.email,
      name: profiles.name,
    })
    .from(engagementClients)
    .innerJoin(profiles, eq(profiles.id, engagementClients.userId))
    .where(eq(engagementClients.engagementId, access.dbId));

  const outgoing = members.find((m) => m.userId === replaceUserId);
  if (!outgoing) {
    // Primary without membership row — treat as owner if pointer matches.
    if (eng.clientUserId === replaceUserId) {
      const [primary] = await db
        .select({
          id: profiles.id,
          email: profiles.email,
          name: profiles.name,
        })
        .from(profiles)
        .where(eq(profiles.id, replaceUserId))
        .limit(1);
      if (!primary) throw new Error('replace_user_not_on_project');
      members.push({
        userId: primary.id,
        memberRole: 'owner',
        email: primary.email,
        name: primary.name,
      });
    } else {
      throw new Error('replace_user_not_on_project');
    }
  }

  const target = members.find((m) => m.userId === replaceUserId);
  if (!target) throw new Error('replace_user_not_on_project');

  if (ctx.role === 'client') {
    const actorOnProject =
      members.some((m) => m.userId === ctx.userId) || eng.clientUserId === ctx.userId;
    if (!actorOnProject) {
      throw new Error('Not permitted to substitute clients');
    }
  }

  const orgClientId = eng.clientId || generateClientId();
  const name = input.fullName?.trim() || email.split('@')[0] || 'Client';
  const wasPrimary = eng.clientUserId === replaceUserId;
  const inheritedRole: 'owner' | 'member' =
    wasPrimary || target.memberRole === 'owner' ? 'owner' : 'member';

  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  let newUserId: string;
  let createdNewUser = false;

  if (existing) {
    if (existing.id === replaceUserId) {
      throw new Error('cannot_substitute_with_same_user');
    }
    if (existing.role !== 'client') {
      throw new Error('email_not_a_client');
    }
    const already = members.some((m) => m.userId === existing.id);
    if (already) {
      throw new Error('already_a_member');
    }
    newUserId = existing.id;
    if (!existing.clientId && orgClientId) {
      await db
        .update(profiles)
        .set({ clientId: orgClientId, updatedAt: new Date() })
        .where(eq(profiles.id, existing.id));
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    const [row] = await db
      .insert(profiles)
      .values({
        email,
        passwordHash,
        name,
        role: 'client',
        status: 'active',
        clientId: orgClientId,
      })
      .returning({ id: profiles.id });
    newUserId = row.id;
    createdNewUser = true;
  }

  const displayName =
    (createdNewUser ? name : existing?.name?.trim() || name) || email;

  await db.transaction(async (tx) => {
    await tx
      .delete(engagementClients)
      .where(
        and(
          eq(engagementClients.engagementId, access.dbId),
          eq(engagementClients.userId, replaceUserId),
        ),
      );

    await tx
      .insert(engagementClients)
      .values({
        engagementId: access.dbId,
        userId: newUserId,
        memberRole: inheritedRole,
        invitedBy: ctx.userId,
      })
      .onConflictDoNothing({
        target: [engagementClients.engagementId, engagementClients.userId],
      });

    await tx
      .update(engagementClients)
      .set({ memberRole: inheritedRole, invitedBy: ctx.userId })
      .where(
        and(
          eq(engagementClients.engagementId, access.dbId),
          eq(engagementClients.userId, newUserId),
        ),
      );

    if (wasPrimary) {
      await tx
        .update(engagements)
        .set({
          clientUserId: newUserId,
          clientName: displayName,
          clientId: orgClientId,
          updatedAt: new Date(),
        })
        .where(eq(engagements.id, access.dbId));

      // Single owner role after primary handoff.
      await tx
        .update(engagementClients)
        .set({ memberRole: 'member' })
        .where(
          and(
            eq(engagementClients.engagementId, access.dbId),
            eq(engagementClients.memberRole, 'owner'),
          ),
        );
      await tx
        .update(engagementClients)
        .set({ memberRole: 'owner' })
        .where(
          and(
            eq(engagementClients.engagementId, access.dbId),
            eq(engagementClients.userId, newUserId),
          ),
        );
    }
  });

  await recordAuditEvent(ctx, {
    engagementId: appEngagementId(access.dbId),
    action: 'client.substitute',
    summary: `Substituted ${target.email} with ${email} on project`,
    actorEmail: ctx.email,
    actorName: ctx.name,
    metadata: {
      replacedUserId: replaceUserId,
      replacedEmail: target.email,
      newUserId,
      newEmail: email,
      createdNewUser,
      memberRole: wasPrimary ? 'owner' : inheritedRole,
      becamePrimary: wasPrimary,
    },
  });

  return {
    replacedUserId: replaceUserId,
    replacedEmail: target.email,
    replacedName: target.name?.trim() || target.email,
    userId: newUserId,
    email,
    name: displayName,
    tempPassword: password,
    createdNewUser,
    memberRole: wasPrimary ? 'owner' : inheritedRole,
    becamePrimary: wasPrimary,
    actorLostAccess: ctx.role === 'client' && ctx.userId === replaceUserId,
    companyName: eng.companyName,
  };
}

/** Backfill membership rows from engagements.client_user_id (idempotent). */
export async function backfillEngagementClientsFromPrimary(): Promise<number> {
  const rows = await db
    .select({ id: engagements.id, clientUserId: engagements.clientUserId })
    .from(engagements);
  let n = 0;
  for (const row of rows) {
    if (!row.clientUserId) continue;
    await ensureEngagementClientMember({
      engagementDbId: row.id,
      userId: row.clientUserId,
      memberRole: 'owner',
    });
    n += 1;
  }
  return n;
}

export async function listClientUserIdsForEngagement(engagementDbId: string): Promise<string[]> {
  const members = await db
    .select({ userId: engagementClients.userId })
    .from(engagementClients)
    .where(eq(engagementClients.engagementId, engagementDbId));
  if (members.length > 0) return members.map((m) => m.userId);

  const [eng] = await db
    .select({ clientUserId: engagements.clientUserId })
    .from(engagements)
    .where(eq(engagements.id, engagementDbId))
    .limit(1);
  return eng?.clientUserId ? [eng.clientUserId] : [];
}

export async function filterEngagementIdsForUsers(
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ engagementId: engagementClients.engagementId })
    .from(engagementClients)
    .where(inArray(engagementClients.userId, userIds));
  return [...new Set(rows.map((r) => r.engagementId))];
}
