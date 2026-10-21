import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementBoardResolutions } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { BoardResolutionDoc } from '@/lib/board-resolution/board-resolution';
import { parseBoardResolutionRpcPayload } from '@/lib/board-resolution/board-resolution';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import {
  checklistStateFromRow,
  getEngagementById,
  patchChecklistItem,
  toAppEngagement,
  type EngagementChecklistState,
} from '@/db/repositories/engagements';
import { isFirmWideAdmin } from '@/lib/auth';
import { internLeadManagerRequestPatch, isLeadRequestPending } from '@/lib/checklist/checklist-item-review';
import { MANAGER_APPROVAL_STEP_ID } from '@/lib/incorporation/pre-inc-direct-flow';
import { directorResponsesFromState } from '@/lib/incorporation/proposed-directors';
import { validateBoardResolutionGeneration } from '@/lib/api/board-resolution-errors';

/** Lead edits while the manager decides are refused with this text. */
export const BOARD_RESOLUTION_WITH_MANAGER = 'The board resolution is with your manager.';

/**
 * BOARD RESOLUTION REPOSITORY.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Scoped via getEngagementById (four-role):
 *   admin: all engagements
 *   manager: owned engagements (manager_id / legacy admin_id)
 *   intern: via assigned engagement; updates only while status = draft
 *           (repairFinalizedStorage is the exception for corrupt-file repair)
 *   client: read via own engagement; may set signed_* after finalize
 */

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function mapRow(row: typeof engagementBoardResolutions.$inferSelect): BoardResolutionDoc {
  return (
    parseBoardResolutionRpcPayload({
      content: row.content,
      status: row.status,
      storagePath: row.storagePath,
      storage_path: row.storagePath,
      draftedAt: toIso(row.draftedAt),
      finalizedAt: toIso(row.finalizedAt),
      finalizedBy: row.finalizedBy,
      updatedAt: toIso(row.updatedAt),
      templateFingerprint: row.templateFingerprint,
      template_fingerprint: row.templateFingerprint,
      signedStoragePath: row.signedStoragePath,
      signed_storage_path: row.signedStoragePath,
      signedUploadedAt: toIso(row.signedUploadedAt),
      signed_uploaded_at: toIso(row.signedUploadedAt),
      signedUploadedBy: row.signedUploadedBy,
      signed_uploaded_by: row.signedUploadedBy,
    }) ?? {
      content: row.content,
      status: row.status === 'finalized' ? 'finalized' : 'draft',
      storagePath: row.storagePath,
    }
  );
}

async function requireEngagement(ctx: AuthContext, appOrDbId: string) {
  const row = await getEngagementById(ctx, engagementDbId(appOrDbId));
  if (!row) throw new Error('Engagement not found or not permitted');
  return row;
}

export async function getBoardResolutionByEngagementId(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<BoardResolutionDoc | null> {
  const engagement = await getEngagementById(ctx, engagementDbId(appOrDbId));
  if (!engagement) return null;

  const [row] = await db
    .select()
    .from(engagementBoardResolutions)
    .where(eq(engagementBoardResolutions.engagementId, engagement.id))
    .limit(1);

  return row ? mapRow(row) : null;
}

export async function saveBoardResolutionDraft(
  ctx: AuthContext,
  appOrDbId: string,
  content: string,
  storagePath?: string | null,
  templateFingerprint?: string | null,
): Promise<BoardResolutionDoc> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not edit board resolution drafts');
  }

  const engagement = await requireEngagement(ctx, appOrDbId);
  assertLeadMayEdit(ctx, checklistStateFromRow(engagement));
  const existing = await getBoardResolutionByEngagementId(ctx, engagement.id);
  if (existing?.status === 'finalized') {
    throw new Error('Board resolution is finalized');
  }

  const now = new Date();
  const values = {
    engagementId: engagement.id,
    content,
    status: 'draft' as const,
    draftedAt: now,
    storagePath: storagePath?.trim() || null,
    templateFingerprint: templateFingerprint?.trim() || null,
    updatedAt: now,
  };

  const [row] = await db
    .insert(engagementBoardResolutions)
    .values(values)
    .onConflictDoUpdate({
      target: engagementBoardResolutions.engagementId,
      set: {
        content: values.content,
        status: 'draft',
        draftedAt: values.draftedAt,
        storagePath: values.storagePath,
        templateFingerprint: values.templateFingerprint,
        updatedAt: values.updatedAt,
      },
    })
    .returning();

  return mapRow(row);
}

/**
 * While `pre-2` waits on the manager the lead cannot change the draft: the
 * manager must approve the document they read.
 */
export function assertLeadMayEdit(ctx: AuthContext, state: EngagementChecklistState): void {
  if (ctx.role === 'intern' && isLeadRequestPending(state[MANAGER_APPROVAL_STEP_ID])) {
    throw new Error(BOARD_RESOLUTION_WITH_MANAGER);
  }
}

/**
 * Lead: "Send for manager approval". The draft must exist as a file and the
 * generation checks must still pass (Part A submitted, nothing missing), so
 * the manager never approves a document built on stale or empty data.
 */
export async function requestBoardResolutionApproval(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<EngagementChecklistState> {
  if (ctx.role !== 'intern') {
    throw new Error('Only the project lead may send the board resolution for approval');
  }
  const engagement = await requireEngagement(ctx, appOrDbId);
  const state = checklistStateFromRow(engagement);
  if (isLeadRequestPending(state[MANAGER_APPROVAL_STEP_ID])) {
    throw new Error(BOARD_RESOLUTION_WITH_MANAGER);
  }
  const doc = await getBoardResolutionByEngagementId(ctx, engagement.id);
  if (!doc || !doc.storagePath?.trim()) {
    throw new Error('board_resolution_not_generated');
  }
  if (doc.status === 'finalized') throw new Error('Board resolution is finalized');

  const { pre1 } = directorResponsesFromState(state);
  validateBoardResolutionGeneration({
    pre1,
    pre1State: state['pre-1'],
    engagement: toAppEngagement(engagement),
  });

  return patchChecklistItem(
    ctx,
    engagement.id,
    MANAGER_APPROVAL_STEP_ID,
    internLeadManagerRequestPatch(state[MANAGER_APPROVAL_STEP_ID]),
  );
}

export interface BoardResolutionApproval {
  boardResolution: BoardResolutionDoc;
  checklistState: EngagementChecklistState;
  /** True when this call is what finalized it (not a repeat click). */
  firstApproval: boolean;
}

/**
 * Manager / admin: "Approve and send to client" — the one pre-incorporation
 * approval. Finalizes the draft (which releases it to the client) and closes
 * `pre-2`. The Approvals inbox Accept and the step's button both land here.
 */
export async function approveBoardResolution(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<BoardResolutionApproval> {
  if (!isFirmWideAdmin(ctx.role) && ctx.role !== 'manager') {
    throw new Error('Only the project manager or admin may approve the board resolution');
  }
  const engagement = await requireEngagement(ctx, appOrDbId);
  const state = checklistStateFromRow(engagement);
  const pre2 = state[MANAGER_APPROVAL_STEP_ID];
  if (!isLeadRequestPending(pre2)) {
    throw new Error('board_resolution_not_pending');
  }

  const before = await getBoardResolutionByEngagementId(ctx, engagement.id);
  const boardResolution = await finalizeBoardResolution(ctx, engagement.id);
  const now = new Date().toISOString();
  const checklistState = await patchChecklistItem(ctx, engagement.id, MANAGER_APPROVAL_STEP_ID, {
    status: 'completed',
    completedOn: now.slice(0, 10),
    deliveredToClientAt: now,
    reviewStatus: 'accepted',
    reviewedAt: now,
    reviewedBy: ctx.userId,
    rejectionNote: undefined,
    responses: {
      boardResolutionSharedAt: pre2?.responses?.boardResolutionSharedAt?.trim() || now.slice(0, 10),
    },
  });
  return { boardResolution, checklistState, firstApproval: before?.status !== 'finalized' };
}

/** Rebuild storage for a finalized doc without changing status (corrupt-file repair). */
export async function repairBoardResolutionStorage(
  ctx: AuthContext,
  appOrDbId: string,
  content: string,
  storagePath: string,
  templateFingerprint?: string | null,
): Promise<BoardResolutionDoc> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not repair board resolution storage');
  }

  const engagement = await requireEngagement(ctx, appOrDbId);
  const path = storagePath.trim();
  if (!path) throw new Error('storage_path required for repair');

  const [row] = await db
    .update(engagementBoardResolutions)
    .set({
      content,
      storagePath: path,
      templateFingerprint: templateFingerprint?.trim() || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(engagementBoardResolutions.engagementId, engagement.id),
        eq(engagementBoardResolutions.status, 'finalized'),
      ),
    )
    .returning();

  if (!row) throw new Error('Finalized board resolution not found');
  return mapRow(row);
}

/** Finalize draft → client-visible board resolution. */
async function finalizeBoardResolution(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<BoardResolutionDoc> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not finalize board resolutions');
  }

  const engagement = await requireEngagement(ctx, appOrDbId);
  const existing = await getBoardResolutionByEngagementId(ctx, engagement.id);
  if (!existing) {
    throw new Error('Board resolution draft not found — generate it first');
  }
  if (existing.status === 'finalized') {
    return existing;
  }
  if (!existing.storagePath?.trim() && !existing.content?.trim()) {
    throw new Error('Board resolution has no document content to finalize');
  }

  const now = new Date();
  const [row] = await db
    .update(engagementBoardResolutions)
    .set({
      status: 'finalized',
      finalizedAt: now,
      finalizedBy: ctx.userId,
      updatedAt: now,
    })
    .where(eq(engagementBoardResolutions.engagementId, engagement.id))
    .returning();

  if (!row) throw new Error('Board resolution not found');
  return mapRow(row);
}

export async function setSignedBoardResolution(
  ctx: AuthContext,
  appOrDbId: string,
  signedStoragePath: string,
): Promise<BoardResolutionDoc> {
  const engagement = await requireEngagement(ctx, appOrDbId);
  const path = signedStoragePath.trim();
  if (!path) throw new Error('signed_storage_path required');

  const existing = await getBoardResolutionByEngagementId(ctx, engagement.id);
  if (!existing || existing.status !== 'finalized') {
    throw new Error('Board resolution is not finalized');
  }

  const now = new Date();
  const [row] = await db
    .update(engagementBoardResolutions)
    .set({
      signedStoragePath: path,
      signedUploadedAt: now,
      signedUploadedBy: ctx.userId,
      updatedAt: now,
    })
    .where(eq(engagementBoardResolutions.engagementId, engagement.id))
    .returning();

  if (!row) throw new Error('Board resolution not found');
  return mapRow(row);
}
