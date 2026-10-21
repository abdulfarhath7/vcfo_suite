import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { normalizeParentIndianRelationship } from '@/data/engagements';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { isFirmWideAdmin } from '@/lib/auth';
import { ensureEngagementClientMember } from '@/db/repositories/engagement-clients';
import { ensureEngagementLead } from '@/db/repositories/engagement-leads-membership';
import { ensureEngagementManager } from '@/db/repositories/engagement-managers-membership';
import type { EngagementDbRow } from './scope';
import { getEngagementById } from './read';

/** Engagement row writes: create, checklist_state, metadata, progress CC, soft delete and restore. */

/** Admin or manager may create. Callers must have passed requireAdminOrManager(). */
export async function createEngagement(
  ctx: AuthContext,
  input: typeof engagements.$inferInsert,
) {
  if (!isFirmWideAdmin(ctx.role) && ctx.role !== 'manager') {
    throw new Error('Only admins or managers may create engagements');
  }
  const [row] = await db.insert(engagements).values(input).returning();
  if (row.clientUserId) {
    await ensureEngagementClientMember({
      engagementDbId: row.id,
      userId: row.clientUserId,
      memberRole: 'owner',
      invitedBy: ctx.userId,
    });
  }
  if (row.internId?.trim()) {
    await ensureEngagementLead({
      engagementDbId: row.id,
      internId: row.internId,
      invitedBy: ctx.userId,
    });
  }
  if (row.managerId) {
    await ensureEngagementManager({
      engagementDbId: row.id,
      managerId: row.managerId,
      invitedBy: ctx.userId,
    });
  }
  return row;
}

/**
 * Update checklist_state. Managers/interns may update assigned engagements;
 * clients may only update their own engagement's checklist_state (the old
 * engagements_guard_client_update trigger enforced column-level limits —
 * reproduce that guard here or in the calling route).
 */
export async function updateChecklistState(
  ctx: AuthContext,
  id: string,
  nextState: Record<string, unknown>,
) {
  const existing = await getEngagementById(ctx, id);
  if (!existing) throw new Error('Engagement not found or not permitted');

  const [row] = await db
    .update(engagements)
    .set({ checklistState: nextState, updatedAt: new Date() })
    .where(eq(engagements.id, id))
    .returning();
  return row;
}

export async function updateEngagement(
  ctx: AuthContext,
  id: string,
  patch: Partial<typeof engagements.$inferInsert>,
) {
  if (ctx.role === 'client') {
    throw new Error('Clients may not edit engagement metadata');
  }
  const existing = await getEngagementById(ctx, id);
  if (!existing) throw new Error('Engagement not found or not permitted');
  const touchesOwnership =
    patch.ownershipType !== undefined ||
    patch.companyType !== undefined ||
    patch.parentIndianRelationship !== undefined;
  if (touchesOwnership) {
    // Only when ownership is being edited: a legacy Indian-subsidiary row with no
    // role chosen must still accept unrelated patches (stage, lead, …).
    const next = normalizeParentIndianRelationship({
      ownershipType: patch.ownershipType ?? existing.ownershipType,
      companyType: patch.companyType ?? existing.companyType,
      parentIndianRelationship:
        patch.parentIndianRelationship !== undefined
          ? patch.parentIndianRelationship
          : existing.parentIndianRelationship,
    });
    if (next.missing) throw new Error('parent_indian_relationship_required');
    patch = { ...patch, parentIndianRelationship: next.value };
  }
  const [row] = await db
    .update(engagements)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(engagements.id, id))
    .returning();
  if (patch.internId !== undefined && patch.internId?.trim()) {
    await ensureEngagementLead({
      engagementDbId: id,
      internId: patch.internId,
      invitedBy: ctx.userId,
    });
  }
  if (patch.managerId !== undefined) {
    if (patch.managerId) {
      await ensureEngagementManager({
        engagementDbId: id,
        managerId: patch.managerId,
        invitedBy: ctx.userId,
      });
    }
  }
  return row;
}

export async function updateProgressCcEmails(
  ctx: AuthContext,
  appOrDbId: string,
  emails: string[],
): Promise<string[]> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not update progress CC');
  }
  const existing = await getEngagementById(ctx, engagementDbId(appOrDbId));
  if (!existing) throw new Error('Engagement not found or not permitted');
  const [row] = await db
    .update(engagements)
    .set({ progressCcEmails: emails, updatedAt: new Date() })
    .where(eq(engagements.id, existing.id))
    .returning({ progressCcEmails: engagements.progressCcEmails });
  return row?.progressCcEmails ?? emails;
}

/* ── Soft delete ────────────────────────────────────────────────────────────
   `scopeFor()` already excludes rows with a non-null deleted_at, so setting it
   removes the project from every list, detail page, and client portal at once
   without destroying documents, checklist history, or the audit trail. Only a
   firm-wide admin may delete or restore; managers go through a change request. */

export async function softDeleteEngagement(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<EngagementDbRow> {
  if (!isFirmWideAdmin(ctx.role)) {
    throw new Error('Only firm admins may delete projects');
  }
  const dbId = engagementDbId(appOrDbId);
  const [row] = await db
    .update(engagements)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(engagements.id, dbId), isNull(engagements.deletedAt)))
    .returning();
  if (!row) throw new Error('Engagement not found');
  return row;
}

export async function restoreEngagement(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<EngagementDbRow> {
  if (!isFirmWideAdmin(ctx.role)) {
    throw new Error('Only firm admins may restore projects');
  }
  const dbId = engagementDbId(appOrDbId);
  const [row] = await db
    .update(engagements)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(engagements.id, dbId))
    .returning();
  if (!row) throw new Error('Engagement not found');
  return row;
}
