import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { isAdminOrManager } from '@/lib/auth';
import {
  checklistStateFromRow,
  getEngagementById,
  patchChecklistItem,
  type EngagementChecklistState,
} from '@/db/repositories/engagements';
import { leadWritablePatch } from '@/lib/checklist/checklist-item-review';
import { stampDinChecks } from '@/lib/checklist/din-verification';
import { CLIENT_RESPONSE_FIELDS, SRN_FIELD_ID } from '@/lib/checklist/checklist-responses';
import { updateFiling } from '@/db/repositories/assist-filings';
import { filingFormForStep } from '@/lib/mca-filing/filing-state';
import { clientChangesNameExpiry, NAME_EXPIRY_CLIENT_REFUSED } from '@/lib/checklist/name-approval-expiry';
import { hiddenEntryAnswersPatch, isRepeatField } from '@/lib/checklist/checklist-repeat';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { syncExpiryItemsForEngagement } from '@/db/repositories/expiry-items';
import { stepFeedsExpiries } from '@/lib/expiries/seed';
import { emptyEmailDispatch, type EmailDispatchResult } from '@/lib/email/email-dispatch';
import { leadManagerRequestNotifyPlan } from '@/lib/email/lead-manager-request-notify';
import { notifyEngagementEventSoon } from '@/lib/email/send-after-response';
import {
  isDirectFlowStep,
  isDirectFlowStepComplete,
  isWaitingOnLead,
  CLIENT_ONLY_FIELDS_REFUSED,
  clientOnlyFieldsChangedBy,
  lastEditedPatch,
  MANAGER_APPROVAL_STEP_ID,
  PROPOSED_DIRECTORS_STEP_ID,
  stripClientOnlyResponses,
  stripLeadOnlyResponses,
} from '@/lib/incorporation/pre-inc-direct-flow';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';

/**
 * The rules of one checklist save, in one place: `POST /api/engagements/:id/checklist` and an
 * approved Ask VCFO changeset both come through here, so neither can write what the other refuses.
 *
 * Clients may only patch responses, notes and status, not review or lock fields. A lead may draft
 * and ask for approval but never release: the fields that accept, complete or deliver a step are
 * the manager's (`reviewChecklistItem`).
 */

/**
 * The step cannot take this person's save as it stands. The route answers with `status`: 409 when
 * the step is closed for now, 403 when this role may never write the field (DR-02).
 */
export class ChecklistPatchRefused extends Error {
  readonly status: 403 | 409;
  constructor(message: string, status: 403 | 409 = 409) {
    super(message);
    this.name = 'ChecklistPatchRefused';
    this.status = status;
  }
}

export type ChecklistPatchInput = { resendManagerEmail?: unknown } & Partial<ChecklistItemStateSlice>;

/** What this person may write of the patch they sent. Pure; throws when the step is closed to them. */
/** Steps whose hidden questions lose their answers on save (SB-03). */
const CLEAR_HIDDEN_ANSWER_STEP_IDS: ReadonlySet<string> = new Set(['pre-16']);

export function checklistPatchForRole(
  ctx: Pick<AuthContext, 'role' | 'name'>,
  itemId: string,
  patchFields: Partial<ChecklistItemStateSlice>,
  prevSlice: ChecklistItemStateSlice | undefined,
  now: string,
): Partial<ChecklistItemStateSlice> {
  // Workflow records only the server's own actions write (BR-05, DR-03), never a form save.
  const { brClientEdit: _bce, openedNotifiedAt: _ona, ...savable } = patchFields;
  let patch: Partial<ChecklistItemStateSlice> = savable;
  const directFlow = isDirectFlowStep(itemId);
  if (directFlow && clientOnlyFieldsChangedBy(ctx.role, itemId, patchFields.responses, prevSlice).length > 0) {
    // DR-02: the lead, a manager or an admin may not change the client's own answers.
    throw new ChecklistPatchRefused(CLIENT_ONLY_FIELDS_REFUSED, 403);
  }
  if (ctx.role === 'client' && directFlow) {
    // Direct flow: the client writes answers only, never a lead-only field,
    // and only while the step is open to them.
    if (isDirectFlowStepComplete(itemId, prevSlice) || isWaitingOnLead(itemId, prevSlice)) {
      throw new ChecklistPatchRefused('This step is submitted. Ask for a change to edit it.');
    }
    if (clientChangesNameExpiry(itemId, patchFields.responses, prevSlice?.responses)) {
      // SA-02: the client reads the name approval expiry date; staff change it.
      throw new ChecklistPatchRefused(NAME_EXPIRY_CLIENT_REFUSED, 403);
    }
    patch = { responses: stripLeadOnlyResponses(itemId, patchFields.responses ?? {}) };
  } else if (ctx.role === 'intern' && directFlow && patchFields.responses) {
    // Direct flow: client-only keys sent with the stored value are dropped (a change was refused above).
    patch = { ...savable, responses: stripClientOnlyResponses(itemId, patchFields.responses, prevSlice) };
  } else if (directFlow && patchFields.responses && isAdminOrManager(ctx.role)) {
    // DR-02: a manager or admin save keeps no client-only key either, whoever the step is assigned to.
    patch = { ...savable, responses: stripClientOnlyResponses(itemId, patchFields.responses) };
  } else if (ctx.role === 'client') {
    const {
      reviewStatus: _rs,
      reviewSource: _src,
      reviewedAt: _ra,
      reviewedBy: _rb,
      rejectionNote: _rn,
      locked: _lk,
      unlockedFields: _uf,
      clientSubmittedAt: _cs,
      deliveredToClientAt: _dt,
      sharedIncorpDraftDocs: _sd,
      incorpDraftsSharedAt: _isa,
      workflowStage: _ws,
      completedOn: _co,
      assigneeId: _ai,
      clientFillRequest: _cfr,
      ...safe
    } = patch;
    patch = safe;
  }
  if (ctx.role === 'intern') {
    patch = leadWritablePatch(patch);
    if (directFlow || itemId === MANAGER_APPROVAL_STEP_ID) {
      // No approval on a direct-flow step: a lead completes it through
      // Submit (which validates), never by stamping a review request here.
      // The board resolution goes to the manager only through
      // "Send for manager approval", which checks the draft first.
      const {
        reviewStatus: _rs,
        reviewSource: _src,
        locked: _lk,
        clientSubmittedAt: _cs,
        unlockedFields: _uf,
        clientFillRequest: _cfr,
        ...draftOnly
      } = patch;
      patch = draftOnly;
    }
  }
  if (patch.responses && itemId === PROPOSED_DIRECTORS_STEP_ID) {
    // DR-01: the server stamps who checked a DIN and when.
    patch = { ...patch, responses: stampDinChecks(prevSlice?.responses ?? {}, patch.responses, ctx.name, now) };
  }
  if (patch.responses && CLEAR_HIDDEN_ANSWER_STEP_IDS.has(itemId)) {
    // SB-03: a changed subscriber type clears the answers of the questions it hides.
    const merged = { ...(prevSlice?.responses ?? {}), ...patch.responses };
    const cleared: Record<string, string> = {};
    for (const field of CLIENT_RESPONSE_FIELDS[itemId] ?? []) {
      if (isRepeatField(field)) Object.assign(cleared, hiddenEntryAnswersPatch(merged, field));
    }
    if (Object.keys(cleared).length) patch = { ...patch, responses: { ...patch.responses, ...cleared } };
  }
  if (directFlow && patch.responses && Object.keys(patch.responses).length > 0) {
    patch = { ...patch, ...lastEditedPatch({ actorName: ctx.name, actorRole: ctx.role, now }) };
  }
  return patch;
}

/** Applies the rules, saves the step and sends the notices a save of this kind sends. */
export async function applyChecklistPatch(
  ctx: AuthContext,
  appOrDbEngagementId: string,
  itemId: string,
  rawPatch: ChecklistPatchInput,
): Promise<{ checklistState: EngagementChecklistState; email: EmailDispatchResult }> {
  const before = await getEngagementById(ctx, engagementDbId(appOrDbEngagementId));
  const prevSlice = before ? checklistStateFromRow(before)[itemId] : undefined;

  const { resendManagerEmail, ...patchFields } = rawPatch;
  const patch = checklistPatchForRole(ctx, itemId, patchFields, prevSlice, new Date().toISOString());

  const checklistState = await patchChecklistItem(ctx, appOrDbEngagementId, itemId, patch);

  // A DSC or licence expiry typed on this step goes on the compliance calendar at once. Additive:
  // a failure is logged and the save stands; the nightly expiry job catches up.
  if (stepFeedsExpiries(itemId)) {
    await syncExpiryItemsForEngagement(ctx, appOrDbEngagementId).catch((error) => {
      console.warn('[expiries] sync after checklist save failed', error instanceof Error ? error.message : error);
    });
  }

  // SA-01: a staff member's acknowledgement number on Part A or Part B is the filing card's SRN
  // too. Additive: a refused SRN (bad format) is logged and the checklist save stands.
  const filingForm = filingFormForStep(itemId);
  const nextSrn = patch.responses?.[SRN_FIELD_ID]?.trim();
  if (filingForm && ctx.role !== 'client' && nextSrn && nextSrn !== prevSlice?.responses?.[SRN_FIELD_ID]?.trim()) {
    await updateFiling(ctx, appOrDbEngagementId, filingForm, { srn: nextSrn }).catch((error) => {
      console.warn('[mca-filing] SRN not copied to the filing record', error instanceof Error ? error.message : error);
    });
  }

  // Autosave is responses-only and must not fan out. Request / Submit /
  // Email manager again send reviewSource or resendManagerEmail.
  const leadNotify = leadManagerRequestNotifyPlan({
    role: ctx.role,
    prevSlice,
    nextSlice: checklistState[itemId],
    patch: { resendManagerEmail: resendManagerEmail === true, ...patch },
  });

  const email = leadNotify.notify
    ? await notifyEngagementEventSoon({
        engagementId: appOrDbEngagementId,
        itemId,
        event: 'lead_requested_review',
        actorUserId: ctx.userId,
        skipInAppNotifications: leadNotify.skipInAppNotifications,
        outlookCtx: ctx,
      })
    : emptyEmailDispatch();

  return { checklistState, email };
}
