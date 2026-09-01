import 'server-only';
import { and, desc, eq, getTableColumns, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagements, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { Engagement } from '@/data/engagements';
import {
  type ChecklistItemStateSlice,
  type ClientFillRequest,
  normalizeEngagementChecklistState,
} from '@/lib/checklist-state-key';
import {
  buildClientFillRequest,
  canRequestClientFill,
  decideClientFillRequest as applyClientFillDecision,
  fulfillClientFillRequest,
  isClientFillPending,
  type ClientFillDecision,
} from '@/lib/checklist-client-fill';
import {
  approvalStateOf,
  buildClientApproval,
  changeRequestReopenPatch,
  buildManagerApproval,
  phaseCompletedByApproval,
  type ChecklistPhaseRef,
} from '@/lib/checklist-step-approval';
import { slimChecklistIndexState } from '@/lib/checklist-index';
import { responseFieldIdsForItem } from '@/lib/checklist-responses';
import { LEGACY_ENGAGEMENT_IDS, engagementDbId } from '@/lib/legacy-engagement-ids';
import { auditChecklistItemPatch } from '@/db/repositories/audit-events';
import { isFirmWideAdmin } from '@/lib/auth';
import { sequentialLockMessage } from '@/lib/checklist-step-gate';
import { resolveCreateProjectManagerAssignment } from '@/lib/create-project-scope';
import {
  ensureEngagementClientMember,
  listClientMemberEngagementIds,
} from '@/db/repositories/engagement-clients';
import {
  ensureEngagementLead,
  listLeadIdsByEngagementIds,
  listLeadMemberEngagementIds,
} from '@/db/repositories/engagement-leads-membership';
import {
  ensureEngagementManager,
  listManagerMemberEngagementIds,
} from '@/db/repositories/engagement-managers-membership';

export type EngagementDbRow = typeof engagements.$inferSelect;
export type EngagementChecklistState = Record<string, ChecklistItemStateSlice>;
/** List/directory rows — same columns as the table except the jsonb blob. */
export type EngagementListRow = Omit<EngagementDbRow, 'checklistState'>;

const { checklistState: _checklistState, ...engagementListColumns } = getTableColumns(engagements);
void _checklistState;

/**
 * Postgres-side slim of checklist_state: drop answers/notes, keep status +
 * sequential-gate fields and the few compliance trigger dates.
 */
const checklistIndexSql = sql<Record<string, unknown>>`
  COALESCE(
    (
      SELECT jsonb_object_agg(
        kv.key,
        (kv.value - 'responses' - 'notes')
        || jsonb_build_object(
          'responses',
          jsonb_strip_nulls(
            jsonb_build_object(
              'dateOfIncorporation', kv.value #>> '{responses,dateOfIncorporation}',
              'gstRegistrationDate', kv.value #>> '{responses,gstRegistrationDate}',
              'pfRegistrationDate', kv.value #>> '{responses,pfRegistrationDate}',
              'esiRegistrationDate', kv.value #>> '{responses,esiRegistrationDate}',
              'panTanAllotmentDate', kv.value #>> '{responses,panTanAllotmentDate}'
            )
          )
        )
      )
      FROM jsonb_each(engagements.checklist_state) AS kv
    ),
    '{}'::jsonb
  )
`;

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
    const memberIds = await listManagerMemberEngagementIds(ctx.userId);
    const conds = [managerOwnsEngagement(ctx.userId)];
    if (memberIds.length > 0) conds.push(inArray(engagements.id, memberIds));
    const roleScope = conds.length === 1 ? conds[0] : or(...conds);
    return and(notDeleted, roleScope);
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

export async function listEngagements(ctx: AuthContext): Promise<EngagementListRow[]> {
  const scope = await scopeFor(ctx);
  return db.select(engagementListColumns).from(engagements).where(scope);
}

/** Role-scoped ids only — used by tasks/requests/activity/invites/audit. */
export async function listScopedEngagementIds(ctx: AuthContext): Promise<string[]> {
  const scope = await scopeFor(ctx);
  const rows = await db.select({ id: engagements.id }).from(engagements).where(scope);
  return rows.map((row) => row.id);
}

/**
 * Slim checklist maps keyed by app engagement id (legacy e1 or uuid).
 * Dashboards / intern Today use this instead of N+1 full /checklist fetches.
 */
export async function listChecklistIndex(
  ctx: AuthContext,
): Promise<Record<string, EngagementChecklistState>> {
  const scope = await scopeFor(ctx);
  const rows = await db
    .select({
      id: engagements.id,
      checklistIndex: checklistIndexSql,
    })
    .from(engagements)
    .where(scope);

  const out: Record<string, EngagementChecklistState> = {};
  for (const row of rows) {
    const appId = LEGACY_ENGAGEMENT_IDS[row.id] ?? row.id;
    const raw = row.checklistIndex;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      out[appId] = {};
      continue;
    }
    out[appId] = slimChecklistIndexState(raw);
  }
  return out;
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

/** Map a DB row to the app Engagement shape (legacy e1 ids preserved). */
export function toAppEngagement(
  row: EngagementListRow | EngagementDbRow,
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
    subsidiaryLegalName: row.subsidiaryLegalName,
    subsidiaryRegisteredAddress: row.subsidiaryRegisteredAddress,
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
    complianceQuestionnaire:
      'complianceQuestionnaire' in row &&
      row.complianceQuestionnaire &&
      typeof row.complianceQuestionnaire === 'object' &&
      !Array.isArray(row.complianceQuestionnaire)
        ? (row.complianceQuestionnaire as Record<string, boolean | number | string>)
        : null,
  };
}

/** Attach leadIds to app engagements in one round-trip. */
export async function toAppEngagementsWithLeads(
  rows: Array<EngagementListRow | EngagementDbRow>,
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
export async function getMyEngagement(ctx: AuthContext): Promise<EngagementListRow | null> {
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

  const persisted = checklistStateFromRow(existing);
  if (ctx.role === 'client') {
    const lockMessage = sequentialLockMessage(itemId, persisted);
    if (lockMessage) {
      throw new Error(lockMessage);
    }
  }

  const base = current ?? persisted;
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
  const existing = await getEngagementById(ctx, engagementDbId(appEngagementId));
  const openRequest = existing
    ? checklistStateFromRow(existing)[itemId]?.clientFillRequest
    : undefined;
  const fulfilled = fulfillClientFillRequest(openRequest, now);
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
    ...(fulfilled ? { clientFillRequest: fulfilled } : {}),
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
    // Accepting is also the hand-off to the client: the step becomes theirs to
    // approve. Reject is deliberately untouched — it stays on the reject/unlock
    // path that already reopens this step and re-locks the ones after it.
    const existing = await getEngagementById(ctx, engagementDbId(appEngagementId));
    const previous = existing ? checklistStateFromRow(existing)[itemId]?.approval : undefined;
    return patchChecklistItem(ctx, appEngagementId, itemId, {
      reviewStatus: 'accepted',
      reviewedAt: now,
      reviewedBy: ctx.userId,
      rejectionNote: undefined,
      status: 'completed',
      completedOn: now.slice(0, 10),
      locked: true,
      approval: buildManagerApproval({
        approvedBy: ctx.userId,
        approvedByName: ctx.name,
        now,
        previous,
      }),
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

export type ClientFillRequestOutcome = {
  checklistState: EngagementChecklistState;
  request: ClientFillRequest;
};

/**
 * Project lead asks the client to fill a step. Nothing reaches the client until
 * a project manager (or firm admin) approves — the caller fans out the emails.
 */
export async function requestClientFill(
  ctx: AuthContext,
  appEngagementId: string,
  itemId: string,
  note?: string | null,
): Promise<ClientFillRequestOutcome> {
  if (ctx.role !== 'intern') {
    throw new Error('Only the project lead may ask the client to fill a step');
  }
  const existing = await getEngagementById(ctx, engagementDbId(appEngagementId));
  if (!existing) throw new Error('Engagement not found or not permitted');
  const current = checklistStateFromRow(existing)[itemId]?.clientFillRequest;
  if (!canRequestClientFill(current)) {
    throw new Error(
      current?.status === 'pending_manager'
        ? 'client_fill_already_pending'
        : 'client_fill_already_with_client',
    );
  }

  const request = buildClientFillRequest({
    requestedBy: ctx.userId,
    requestedByName: ctx.name,
    note: note ?? undefined,
    now: new Date().toISOString(),
  });
  const checklistState = await patchChecklistItem(ctx, appEngagementId, itemId, {
    clientFillRequest: request,
  });
  return { checklistState, request };
}

/** Manager / firm admin approves or declines the lead's ask. Leads may not. */
export async function decideClientFillRequest(
  ctx: AuthContext,
  appEngagementId: string,
  itemId: string,
  decision: ClientFillDecision,
  note?: string | null,
): Promise<ClientFillRequestOutcome> {
  if (!isFirmWideAdmin(ctx.role) && ctx.role !== 'manager') {
    throw new Error('Only the project manager or admin may decide a client fill request');
  }
  const existing = await getEngagementById(ctx, engagementDbId(appEngagementId));
  if (!existing) throw new Error('Engagement not found or not permitted');
  const current = checklistStateFromRow(existing)[itemId]?.clientFillRequest;
  if (!isClientFillPending(current) || !current) {
    throw new Error('client_fill_not_pending');
  }

  const request = applyClientFillDecision(current, {
    decision,
    decidedBy: ctx.userId,
    decidedByName: ctx.name,
    note: note ?? undefined,
    now: new Date().toISOString(),
  });
  const checklistState = await patchChecklistItem(ctx, appEngagementId, itemId, {
    clientFillRequest: request,
    ...(decision === 'approve' ? { status: 'awaiting-client' as const } : {}),
  });
  return { checklistState, request };
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
  /** WhatsApp destination in E.164. Stored on the client profile, not the engagement. */
  clientPhoneE164?: string;
  /** Explicit WhatsApp consent captured on the create form. */
  clientWhatsappConsent?: boolean;
  /** Primary lead (legacy). Prefer internIds when present. */
  internId?: string;
  /** One or more project leads (profiles.intern_id / profile id). First becomes primary. */
  internIds?: string[];
  /** Primary manager. Prefer managerIds when present. */
  managerId?: string;
  /** One or more project managers (profile UUIDs). First becomes primary. */
  managerIds?: string[];
  stage?: Engagement['stage'];
  health?: Engagement['health'];
  subsidiaryLegalName?: string;
  subsidiaryRegisteredAddress?: string;
  complianceQuestionnaire?: Record<string, boolean | number | string>;
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

  const { primaryManagerId, uniqueManagerIds } = resolveCreateProjectManagerAssignment({
    role: ctx.role,
    userId: ctx.userId,
    managerId: input.managerId,
    managerIds: input.managerIds,
  });

  const leadKeysRaw = [
    ...(input.internIds ?? []),
    ...(input.internId ? [input.internId] : []),
  ]
    .map((id) => id.trim())
    .filter(Boolean);
  const uniqueLeadKeys = [...new Set(leadKeysRaw)];
  if (uniqueLeadKeys.length === 0) {
    throw new Error('Invalid internId — at least one project lead is required');
  }

  const {
    createClientProfile,
    resolveInternScopingId,
  } = await import('@/db/repositories/profiles');

  const resolvedLeadIds: string[] = [];
  for (const key of uniqueLeadKeys) {
    const resolved = await resolveInternScopingId(key);
    if (!resolved) {
      throw new Error('Invalid internId — no intern profile found');
    }
    if (!resolvedLeadIds.includes(resolved)) resolvedLeadIds.push(resolved);
  }
  const primaryLeadId = resolvedLeadIds[0];

  const clientName =
    input.clientName?.trim() || input.companyName.trim() || input.clientEmail.trim();

  const client = await createClientProfile(ctx, {
    email: input.clientEmail,
    password: input.clientPassword,
    fullName: clientName,
    phoneE164: input.clientPhoneE164,
    // Consent only counts when a number was actually given.
    whatsappConsent: Boolean(input.clientWhatsappConsent && input.clientPhoneE164?.trim()),
  });

  const slug = await uniqueEngagementSlug(input.companyName);
  const stage = input.stage ?? 'Pre-Incorporation';
  const health = input.health ?? 'on-track';
  const needsSubsidiary =
    stage === 'Post-Incorporation' || stage === 'Operational Readiness';
  const subsidiaryLegalName = input.subsidiaryLegalName?.trim() || null;
  const subsidiaryRegisteredAddress = input.subsidiaryRegisteredAddress?.trim() || null;
  if (needsSubsidiary) {
    if (!subsidiaryLegalName) {
      throw new Error('subsidiary_legal_name_required');
    }
    if (!subsidiaryRegisteredAddress) {
      throw new Error('subsidiary_registered_address_required');
    }
  }

  try {
    const row = await createEngagement(ctx, {
      slug,
      companyName: input.companyName.trim(),
      companyType: input.companyType,
      entityLegalForm: input.entityLegalForm ?? 'company',
      parentEntityName: input.parentEntityName.trim(),
      parentEntityAddress: input.parentEntityAddress.trim(),
      subsidiaryLegalName: needsSubsidiary ? subsidiaryLegalName : null,
      subsidiaryRegisteredAddress: needsSubsidiary ? subsidiaryRegisteredAddress : null,
      clientId: client.clientId,
      clientUserId: client.userId,
      internId: primaryLeadId,
      managerId: primaryManagerId,
      adminId: isFirmWideAdmin(ctx.role) ? ctx.userId : null,
      clientName,
      stage,
      health,
      checklistState: {},
      complianceQuestionnaire: input.complianceQuestionnaire ?? {},
    });

    for (const leadId of resolvedLeadIds) {
      await ensureEngagementLead({
        engagementDbId: row.id,
        internId: leadId,
        invitedBy: ctx.userId,
      });
    }
    for (const mid of uniqueManagerIds.length ? uniqueManagerIds : [primaryManagerId]) {
      await ensureEngagementManager({
        engagementDbId: row.id,
        managerId: mid,
        invitedBy: ctx.userId,
      });
    }

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

/** Recycle bin — soft-deleted projects, newest first. Admin only. */
export async function listDeletedEngagements(ctx: AuthContext): Promise<EngagementListRow[]> {
  if (!isFirmWideAdmin(ctx.role)) return [];
  return db
    .select(engagementListColumns)
    .from(engagements)
    .where(isNotNull(engagements.deletedAt))
    .orderBy(desc(engagements.deletedAt));
}

/** Unscoped read used by delete/restore flows — a soft-deleted row is invisible to getEngagementById. */
export async function getEngagementIncludingDeleted(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<EngagementDbRow | null> {
  if (!isFirmWideAdmin(ctx.role)) return null;
  const [row] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, engagementDbId(appOrDbId)))
    .limit(1);
  return row ?? null;
}

/* ------------------------------------------------------------------ *
 * Three-party step approval: lead → manager → client.
 *
 * Role scoping lives HERE, not in the routes, so every caller inherits it:
 *   - only a manager or firm admin with access may hand a step to the client
 *     (that runs through `reviewChecklistItem`'s accept branch)
 *   - only the client on the engagement may approve or ask for a change
 * `getEngagementById` is the tenant boundary in all three: a caller who cannot
 * see the engagement gets "not found", never a row from someone else's file.
 * ------------------------------------------------------------------ */

export type StepApprovalOutcome = {
  checklistState: EngagementChecklistState;
  /** Set only when THIS approval completed the phase and nothing has announced it yet. */
  phaseCompleted: ChecklistPhaseRef | null;
};

/**
 * Client signs off a step the manager has handed them.
 *
 * When this closes the last outstanding step in its phase, the phase is
 * returned so the caller can send the single phase-approved email, and the
 * completing step is stamped so a double-click or a refresh cannot send it
 * twice.
 */
export async function clientApproveStep(
  ctx: AuthContext,
  appEngagementId: string,
  itemId: string,
): Promise<StepApprovalOutcome> {
  if (ctx.role !== 'client') {
    throw new Error('Only the client may approve a step');
  }
  const existing = await getEngagementById(ctx, engagementDbId(appEngagementId));
  if (!existing) throw new Error('Engagement not found or not permitted');

  const persisted = checklistStateFromRow(existing);
  const previous = persisted[itemId]?.approval;
  const state = approvalStateOf(persisted[itemId]);
  if (state === 'client_approved') {
    // Idempotent: a second click is a no-op, not an error and not a re-send.
    return { checklistState: persisted, phaseCompleted: null };
  }
  if (state !== 'pending_client') {
    throw new Error('step_not_awaiting_client_approval');
  }

  const now = new Date().toISOString();
  const approval = buildClientApproval({
    approvedBy: ctx.userId,
    approvedByName: ctx.name,
    now,
    previous,
  });

  let checklistState = await patchChecklistItem(ctx, appEngagementId, itemId, { approval });

  const phaseCompleted = phaseCompletedByApproval(itemId, checklistState);
  if (phaseCompleted) {
    // Stamp before the caller sends. A crash after this point loses an email;
    // a stamp after the send could send twice on a retry.
    checklistState = await patchChecklistItem(ctx, appEngagementId, itemId, {
      approval: { ...approval, phaseCompletionNotifiedAt: now },
    });
  }

  return { checklistState, phaseCompleted };
}

/**
 * Client asks for a change on a step they were handed.
 *
 * Reopening reuses the existing reject/unlock mechanics rather than inventing
 * gating: `reviewStatus: 'rejected'` plus reopened fields is exactly what
 * `isChecklistStepSequentiallyComplete` reads, so every step after this one
 * re-locks the same way a manager rejection re-locks them.
 */
export async function clientRequestStepChange(
  ctx: AuthContext,
  appEngagementId: string,
  itemId: string,
  note: string,
): Promise<{ checklistState: EngagementChecklistState; note: string }> {
  if (ctx.role !== 'client') {
    throw new Error('Only the client may ask for a change');
  }
  const trimmed = note.trim();
  if (!trimmed) throw new Error('A change request needs a note');

  const existing = await getEngagementById(ctx, engagementDbId(appEngagementId));
  if (!existing) throw new Error('Engagement not found or not permitted');

  const persisted = checklistStateFromRow(existing);
  const state = approvalStateOf(persisted[itemId]);
  if (state !== 'pending_client' && state !== 'client_approved') {
    throw new Error('step_not_with_client');
  }

  const now = new Date().toISOString();
  const checklistState = await patchChecklistItem(
    ctx,
    appEngagementId,
    itemId,
    changeRequestReopenPatch({
      itemId,
      note: trimmed,
      requestedBy: ctx.userId,
      requestedByName: ctx.name,
      now,
      previous: persisted[itemId]?.approval,
    }),
  );

  return { checklistState, note: trimmed };
}
