import 'server-only';

import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementLeads, engagements, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { isAdminOrManager } from '@/lib/auth';
import { resolveInternScopingId } from '@/db/repositories/profiles';
import { ensureEngagementLead } from '@/db/repositories/engagement-leads-membership';

export type EngagementLeadMember = {
  internId: string;
  name: string;
  email: string;
  profileId: string | null;
  isPrimary: boolean;
  createdAt: string;
};

export {
  ensureEngagementLead,
  listLeadIdsByEngagementIds,
  listLeadMemberEngagementIds,
} from '@/db/repositories/engagement-leads-membership';

export async function listEngagementLeads(
  ctx: AuthContext,
  appOrDbEngagementId: string,
): Promise<EngagementLeadMember[]> {
  const access = await assertEngagementAccess(ctx, appOrDbEngagementId);
  if (!access.ok) {
    throw new Error('Engagement not found or not permitted');
  }

  const rows = await db
    .select({
      internId: engagementLeads.internId,
      createdAt: engagementLeads.createdAt,
      email: profiles.email,
      name: profiles.name,
      profileId: profiles.id,
    })
    .from(engagementLeads)
    .leftJoin(profiles, eq(profiles.internId, engagementLeads.internId))
    .where(eq(engagementLeads.engagementId, access.dbId))
    .orderBy(asc(engagementLeads.createdAt));

  const primary = access.row.internId ?? '';

  return rows.map((r) => ({
    internId: r.internId,
    name: r.name?.trim() || r.email || r.internId,
    email: r.email ?? '',
    profileId: r.profileId,
    isPrimary: r.internId === primary,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Admin or manager: add a lead to the project. */
export async function addEngagementLead(
  ctx: AuthContext,
  appOrDbEngagementId: string,
  internKey: string,
): Promise<EngagementLeadMember[]> {
  if (!isAdminOrManager(ctx.role)) {
    throw new Error('Not permitted');
  }
  const access = await assertEngagementAccess(ctx, appOrDbEngagementId);
  if (!access.ok) {
    throw new Error('Engagement not found or not permitted');
  }

  const resolved = await resolveInternScopingId(internKey);
  if (!resolved) throw new Error('Lead not found');

  await ensureEngagementLead({
    engagementDbId: access.dbId,
    internId: resolved,
    invitedBy: ctx.userId,
  });

  if (!access.row.internId?.trim()) {
    await db
      .update(engagements)
      .set({ internId: resolved, updatedAt: new Date() })
      .where(eq(engagements.id, access.dbId));
  }

  return listEngagementLeads(ctx, access.dbId);
}

/**
 * Admin or manager: replace one lead with another.
 * If the removed lead was primary, the new lead becomes primary.
 */
export async function replaceEngagementLead(
  ctx: AuthContext,
  appOrDbEngagementId: string,
  fromInternKey: string,
  toInternKey: string,
): Promise<EngagementLeadMember[]> {
  if (!isAdminOrManager(ctx.role)) {
    throw new Error('Not permitted');
  }
  const access = await assertEngagementAccess(ctx, appOrDbEngagementId);
  if (!access.ok) {
    throw new Error('Engagement not found or not permitted');
  }

  const fromId = await resolveInternScopingId(fromInternKey);
  const toId = await resolveInternScopingId(toInternKey);
  if (!fromId || !toId) throw new Error('Lead not found');
  if (fromId === toId) return listEngagementLeads(ctx, access.dbId);

  await db
    .delete(engagementLeads)
    .where(
      and(
        eq(engagementLeads.engagementId, access.dbId),
        eq(engagementLeads.internId, fromId),
      ),
    );

  await ensureEngagementLead({
    engagementDbId: access.dbId,
    internId: toId,
    invitedBy: ctx.userId,
  });

  const wasPrimary = access.row.internId === fromId || !access.row.internId?.trim();
  if (wasPrimary) {
    await db
      .update(engagements)
      .set({ internId: toId, updatedAt: new Date() })
      .where(eq(engagements.id, access.dbId));
  }

  return listEngagementLeads(ctx, access.dbId);
}

/** Admin or manager: remove a lead from the project. */
export async function removeEngagementLead(
  ctx: AuthContext,
  appOrDbEngagementId: string,
  internKey: string,
): Promise<EngagementLeadMember[]> {
  if (!isAdminOrManager(ctx.role)) {
    throw new Error('Not permitted');
  }
  const access = await assertEngagementAccess(ctx, appOrDbEngagementId);
  if (!access.ok) {
    throw new Error('Engagement not found or not permitted');
  }

  const resolved = await resolveInternScopingId(internKey);
  if (!resolved) throw new Error('Lead not found');

  await db
    .delete(engagementLeads)
    .where(
      and(
        eq(engagementLeads.engagementId, access.dbId),
        eq(engagementLeads.internId, resolved),
      ),
    );

  if (access.row.internId === resolved) {
    const remaining = await db
      .select({ internId: engagementLeads.internId })
      .from(engagementLeads)
      .where(eq(engagementLeads.engagementId, access.dbId))
      .orderBy(asc(engagementLeads.createdAt))
      .limit(1);

    await db
      .update(engagements)
      .set({
        internId: remaining[0]?.internId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(engagements.id, access.dbId));
  }

  return listEngagementLeads(ctx, access.dbId);
}
