import 'server-only';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagements, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { Engagement } from '@/data/engagements';
import {
  type ChecklistItemStateSlice,
  normalizeEngagementChecklistState,
} from '@/lib/checklist-state-key';
import { responseFieldIdsForItem } from '@/lib/checklist-responses';
import { LEGACY_ENGAGEMENT_IDS, engagementDbId } from '@/lib/legacy-engagement-ids';
import { auditChecklistItemPatch } from '@/db/repositories/audit-events';
import { isFirmWideAdmin } from '@/lib/auth';
import {
  ensureEngagementClientMember,
  listClientMemberEngagementIds,
} from '@/db/repositories/engagement-clients';
import {
  ensureEngagementLead,
  listLeadIdsByEngagementIds,
  listLeadMemberEngagementIds,
} from '@/db/repositories/engagement-leads-membership';

export type EngagementDbRow = typeof engagements.$inferSelect;
export type EngagementChecklistState = Record<string, ChecklistItemStateSlice>;

/**
 * ENGAGEMENTS REPOSITORY — the reference implementation of the seam.
 *
 * This is the ONLY place engagements are read/written. Everything above the
 * seam (views, domain logic) calls these functions and never touches `db`.
 *
 * >>> ACCESS CONTROL (Path A) lives HERE. <<<
 * Four-role model:
 *   admin   — unrestricted (firm-wide), like the old manager role
 *   manager — engagements where manager_id = ctx.userId
 *             (legacy fallback: manager_id IS NULL AND admin_id = ctx.userId)
 *   intern  — intern_id = ctx.internId
 *   client  — client_user_id = ctx.userId OR client_id = ctx.clientId
 */

/** SQL predicate: project manager owns this engagement (incl. legacy admin_id). */
export function managerOwnsEngagement(userId: string) {
  return or(
    eq(engagements.managerId, userId),
    and(isNull(engagements.managerId), eq(engagements.adminId, userId)),
  );
}

/** True when a loaded row is owned by this manager (legacy-aware). */
export function rowOwnedByManager(
  row: Pick<EngagementDbRow, 'managerId' | 'adminId'>,
  userId: string,
): boolean {
  return (
    row.managerId === userId ||
    (row.managerId == null && row.adminId === userId)
  );
}

/** Build the role-scoped WHERE clause used by list/get. Soft-deleted rows excluded. */
async function scopeFor(ctx: AuthContext) {
  const notDeleted = isNull(engagements.deletedAt);
  if (isFirmWideAdmin(ctx.role)) return notDeleted;
  if (ctx.role === 'manager') {
    return and(notDeleted, managerOwnsEngagement(ctx.userId));
  }
  if (ctx.role === 'intern') {
    if (!ctx.internId) return eq(engagements.id, '__none__');
    const memberIds = await listLeadMemberEngagementIds(ctx.internId);
    const conds = [eq(engagements.internId, ctx.internId)];
    if (memberIds.length > 0) conds.push(inArray(engagements.id, memberIds));
    const roleScope = conds.length === 1 ? conds[0] : or(...conds);
    return and(notDeleted, roleScope);
  }
  // client — primary pointer, org clientId, or engagement_clients membership
  const memberIds = await listClientMemberEngagementIds(ctx.userId);
  const conds = [];
  conds.push(eq(engagements.clientUserId, ctx.userId));
  if (ctx.clientId) conds.push(eq(engagements.clientId, ctx.clientId));
  if (memberIds.length > 0) conds.push(inArray(engagements.id, memberIds));
  const roleScope = conds.length === 1 ? conds[0] : or(...conds);
  return and(notDeleted, roleScope);
}

export async function listEngagements(ctx: AuthContext) {
  const scope = await scopeFor(ctx);
  return db.select().from(engagements).where(scope);
}

export async function getEngagementById(ctx: AuthContext, id: string) {
  const scope = await scopeFor(ctx);
  const [row] = await db
    .select()
    .from(engagements)
    .where(and(eq(engagements.id, id), scope))
    .limit(1);
  return row ?? null;
}

export async function getEngagementBySlug(ctx: AuthContext, slug: string) {
  const scope = await scopeFor(ctx);
  const [row] = await db
    .select()
    .from(engagements)
    .where(and(eq(engagements.slug, slug), scope))
    .limit(1);
  return row ?? null;
}

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
  return row;
}

/** Map a DB row to the app Engagement shape (legacy e1 ids preserved). */
export function toAppEngagement(
  row: EngagementDbRow,
  client?: { email: string; name: string | null } | null,
  leadIds?: string[],
): Engagement {
  const primary = row.internId ?? '';
  const leads =
    leadIds && leadIds.length > 0
      ? Array.from(new Set(leadIds))
      : primary
        ? [primary]
        : [];
  return {
    id: LEGACY_ENGAGEMENT_IDS[row.id] ?? row.id,
    slug: row.slug,
    clientId: row.clientId,
    companyName: row.companyName,
    companyType: row.companyType as Engagement['companyType'],
    entityLegalForm: (row.entityLegalForm ?? 'company') as Engagement['entityLegalForm'],
    incorporationDate: row.incorporationDate ?? null,
    parentEntityName: row.parentEntityName,
    parentEntityAddress: row.parentEntityAddress,
    parentEntityRegistrationNumber: row.parentEntityRegistrationNumber,
    internId: primary,
    leadIds: leads,
    adminId: row.adminId ?? 'admin',
    managerId: row.managerId ?? undefined,
    createdAt: row.createdAt.toISOString().slice(0, 10),
    stage: row.stage as Engagement['stage'],
    health: row.health as Engagement['health'],
    clientUserId: row.clientUserId,
    clientEmail: client?.email ?? null,
    clientDisplayName: row.clientName?.trim() || client?.name?.trim() || null,
  };
}

/** Attach leadIds to app engagements in one round-trip. */
export async function toAppEngagementsWithLeads(
  rows: EngagementDbRow[],
): Promise<Engagement[]> {
  const leadMap = await listLeadIdsByEngagementIds(rows.map((r) => r.id));
  return rows.map((row) => toAppEngagement(row, null, leadMap.get(row.id)));
}

/**
 * Unscoped existence + role check. Distinguishes notFound vs forbidden so
 * API routes can return the same status codes as the old RLS-backed helpers.
 */
export async function assertEngagementAccess(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<
  | { ok: true; dbId: string; row: EngagementDbRow }
  | { ok: false; dbId: string; notFound: true }
  | { ok: false; dbId: string; forbidden: true }
> {
  const dbId = engagementDbId(appOrDbId);
  const [row] = await db.select().from(engagements).where(eq(engagements.id, dbId)).limit(1);
  if (!row || row.deletedAt) return { ok: false, dbId, notFound: true };

  if (isFirmWideAdmin(ctx.role)) return { ok: true, dbId, row };

  if (ctx.role === 'manager') {
    if (rowOwnedByManager(row, ctx.userId)) return { ok: true, dbId, row };
    return { ok: false, dbId, forbidden: true };
  }

  if (ctx.role === 'intern') {
    if (ctx.internId && row.internId === ctx.internId) return { ok: true, dbId, row };
    if (ctx.internId) {
      const memberIds = await listLeadMemberEngagementIds(ctx.internId);
      if (memberIds.includes(dbId)) return { ok: true, dbId, row };
    }
    return { ok: false, dbId, forbidden: true };
  }

  if (ctx.role === 'client') {
    const isOwner =
      row.clientUserId === ctx.userId ||
      (Boolean(ctx.clientId) && row.clientId === ctx.clientId);
    if (isOwner) return { ok: true, dbId, row };
    const memberIds = await listClientMemberEngagementIds(ctx.userId);
    if (memberIds.includes(dbId)) return { ok: true, dbId, row };
    return { ok: false, dbId, forbidden: true };
  }

  return { ok: false, dbId, forbidden: true };
}

/** Client portal: the single engagement owned by the session user. */
export async function getMyEngagement(ctx: AuthContext): Promise<EngagementDbRow | null> {
  if (ctx.role !== 'client') return null;
  const rows = await listEngagements(ctx);
  return rows[0] ?? null;
}

export function checklistStateFromRow(row: EngagementDbRow): EngagementChecklistState {
  const raw = row.checklistState;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return normalizeEngagementChecklistState(raw as Record<string, unknown>);
}

/** Merge one checklist item into checklist_state and persist. */
export async function patchChecklistItem(
  ctx: AuthContext,
  appEngagementId: string,
  itemId: string,
  patch: Partial<ChecklistItemStateSlice>,
  current?: EngagementChecklistState,
): Promise<EngagementChecklistState> {
  const existing = await getEngagementById(ctx, engagementDbId(appEngagementId));
  if (!existing) throw new Error('Engagement not found or not permitted');

  const base = current ?? checklistStateFromRow(existing);
  const next: EngagementChecklistState = {
    ...base,
    [itemId]: {
      status: 'not-started',
      ...base[itemId],
      ...patch,
      ...(patch.responses
        ? {
            responses: {
              ...(base[itemId]?.responses ?? {}),
              ...patch.responses,
            },
          }
        : {}),
    },
  };
  const normalized = normalizeEngagementChecklistState(next);
  await updateChecklistState(ctx, existing.id, normalized);
  auditChecklistItemPatch(ctx, LEGACY_ENGAGEMENT_IDS[existing.id] ?? existing.id, itemId, patch, base);
  return normalized;
}

/** Client submit: lock responses and mark awaiting manager/lead review. */
export async function submitChecklistItem(
  ctx: AuthContext,
  appEngagementId: string,
  itemId: string,
  responses: Record<string, string>,
): Promise<EngagementChecklistState> {
  const access = await assertEngagementAccess(ctx, appEngagementId);
  if (!access.ok) {
    throw new Error('Engagement not found or not permitted');
  }
  if (ctx.role !== 'client') {
    throw new Error('Only clients may submit checklist items');
  }
  const now = new Date().toISOString();
  return patchChecklistItem(ctx, appEngagementId, itemId, {
    responses,
    clientSubmittedAt: now,
    locked: true,
    reviewStatus: 'reviewing',
    reviewSource: 'client_submission',
    unlockedFields: [],
    rejectionNote: undefined,
    reviewedAt: undefined,
    reviewedBy: undefined,
  });
}

/** Manager/admin accept/reject a client (or lead) submission. Leads may not approve. */
export async function reviewChecklistItem(
  ctx: AuthContext,
  appEngagementId: string,
  itemId: string,
  action: 'accept' | 'reject',
  note?: string | null,
): Promise<EngagementChecklistState> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not review checklist items');
  }
  if (ctx.role === 'intern') {
    throw new Error('Only the project manager or admin may approve KYC / milestone reviews');
  }
  if (!isFirmWideAdmin(ctx.role) && ctx.role !== 'manager') {
    throw new Error('Only the project manager or admin may approve KYC / milestone reviews');
  }
  const now = new Date().toISOString();
  if (action === 'accept') {
    return patchChecklistItem(ctx, appEngagementId, itemId, {
      reviewStatus: 'accepted',
      reviewedAt: now,
      reviewedBy: ctx.userId,
      rejectionNote: undefined,
      status: 'completed',
      completedOn: now.slice(0, 10),
      locked: true,
    });
  }
  return patchChecklistItem(ctx, appEngagementId, itemId, {
    reviewStatus: 'rejected',
    reviewedAt: now,
    reviewedBy: ctx.userId,
    rejectionNote: note?.trim() || undefined,
    locked: true,
    // Auto-reopen all response fields so the client can fix and resubmit.
    unlockedFields: responseFieldIdsForItem(itemId),
  });
}

/** Staff reopen specific client fields after submit/reject. */
export async function unlockChecklistFields(
  ctx: AuthContext,
  appEngagementId: string,
  itemId: string,
  unlockedFields: string[],
): Promise<EngagementChecklistState> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not unlock checklist fields');
  }
  return patchChecklistItem(ctx, appEngagementId, itemId, {
    unlockedFields: unlockedFields.filter((id) => typeof id === 'string' && id.trim()),
  });
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

/** Load client profile email/name for welcome-email resend. */
export async function getClientProfileForEngagement(
  ctx: AuthContext,
  clientUserId: string,
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (ctx.role !== 'admin' && ctx.role !== 'manager') return null;
  const [row] = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name })
    .from(profiles)
    .where(and(eq(profiles.id, clientUserId), eq(profiles.role, 'client')))
    .limit(1);
  return row ?? null;
}

export interface CreateProjectWithClientInput {
  companyName: string;
  companyType: string;
  entityLegalForm?: string;
  parentEntityName: string;
  parentEntityAddress: string;
  clientEmail: string;
  clientPassword: string;
  clientName?: string;
  internId: string;
  /** Required when ctx.role === 'admin'; ignored for managers (forced to self). */
  managerId?: string;
  stage?: Engagement['stage'];
  health?: Engagement['health'];
}

export interface CreateProjectWithClientResult {
  engagement: Engagement;
  clientId: string;
  clientUserId: string;
}

async function uniqueEngagementSlug(companyName: string): Promise<string> {
  const { slugifyCompanyName } = await import('@/lib/slug');
  const base = slugifyCompanyName(companyName);
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const [hit] = await db
      .select({ id: engagements.id })
      .from(engagements)
      .where(eq(engagements.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

/**
 * Admin or manager: create client profile + engagement in one flow.
 * Caller sends welcome email separately (password is one-time, never logged here).
 */
export async function createProjectWithClient(
  ctx: AuthContext,
  input: CreateProjectWithClientInput,
): Promise<CreateProjectWithClientResult> {
  if (!isFirmWideAdmin(ctx.role) && ctx.role !== 'manager') {
    throw new Error('Only admins or managers may create projects');
  }

  const managerId =
    ctx.role === 'manager'
      ? ctx.userId
      : input.managerId?.trim() || null;
  if (!managerId) {
    throw new Error('managerId is required when creating as admin');
  }

  const {
    createClientProfile,
    resolveInternScopingId,
  } = await import('@/db/repositories/profiles');

  const resolvedInternId = await resolveInternScopingId(input.internId);
  if (!resolvedInternId) {
    throw new Error('Invalid internId — no intern profile found');
  }

  const clientName =
    input.clientName?.trim() || input.companyName.trim() || input.clientEmail.trim();

  const client = await createClientProfile(ctx, {
    email: input.clientEmail,
    password: input.clientPassword,
    fullName: clientName,
  });

  const slug = await uniqueEngagementSlug(input.companyName);
  const stage = input.stage ?? 'Pre-Incorporation';
  const health = input.health ?? 'on-track';

  try {
    const row = await createEngagement(ctx, {
      slug,
      companyName: input.companyName.trim(),
      companyType: input.companyType,
      entityLegalForm: input.entityLegalForm ?? 'company',
      parentEntityName: input.parentEntityName.trim(),
      parentEntityAddress: input.parentEntityAddress.trim(),
      clientId: client.clientId,
      clientUserId: client.userId,
      internId: resolvedInternId,
      managerId,
      adminId: isFirmWideAdmin(ctx.role) ? ctx.userId : null,
      clientName,
      stage,
      health,
      checklistState: {},
    });

    return {
      engagement: toAppEngagement(row, { email: client.email, name: client.name }),
      clientId: client.clientId,
      clientUserId: client.userId,
    };
  } catch (err) {
    // Best-effort cleanup of the orphaned client profile.
    await db.delete(profiles).where(eq(profiles.id, client.userId));
    throw err;
  }
}
