import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

/** Fields the intern PATCH may send to request / retry manager-approval mail. */
export type LeadManagerRequestPatchHint = {
  resendManagerEmail?: unknown;
  reviewSource?: unknown;
  reviewStatus?: unknown;
};

export function isAwaitingLeadManagerRequest(
  slice: ChecklistItemStateSlice | null | undefined,
): boolean {
  return (
    slice?.reviewSource === 'lead_manager_request' && slice?.reviewStatus === 'reviewing'
  );
}

/**
 * True when the intern PATCH itself asks to email managers — Request / Submit /
 * Email again. Response-only autosave must stay false even if the step is
 * already awaiting review (or `current` carries that state).
 */
export function internPatchAsksManagerEmail(patch: LeadManagerRequestPatchHint): boolean {
  return (
    patch.resendManagerEmail === true || patch.reviewSource === 'lead_manager_request'
  );
}

function responsesChanged(
  prevSlice: ChecklistItemStateSlice | null | undefined,
  nextSlice: ChecklistItemStateSlice | null | undefined,
): boolean {
  return JSON.stringify(prevSlice?.responses ?? {}) !== JSON.stringify(nextSlice?.responses ?? {});
}

/**
 * When to fan out `lead_requested_review` after a checklist PATCH.
 * Autosave / draft persist must not email or toast.
 */
export function leadManagerRequestNotifyPlan(input: {
  role: string;
  prevSlice?: ChecklistItemStateSlice | null;
  nextSlice?: ChecklistItemStateSlice | null;
  patch: LeadManagerRequestPatchHint;
}): { notify: boolean; skipInAppNotifications: boolean } {
  const awaiting = isAwaitingLeadManagerRequest(input.nextSlice);
  if (!awaiting || input.role !== 'intern') {
    return { notify: false, skipInAppNotifications: false };
  }

  const retry = input.patch.resendManagerEmail === true;
  const notify = internPatchAsksManagerEmail(input.patch);
  if (!notify) {
    return { notify: false, skipInAppNotifications: false };
  }

  const enteredLeadReview =
    input.prevSlice?.reviewSource !== 'lead_manager_request' ||
    input.prevSlice?.reviewStatus !== 'reviewing';
  const answersChanged = responsesChanged(input.prevSlice, input.nextSlice);

  return {
    notify: true,
    skipInAppNotifications: retry && !enteredLeadReview && !answersChanged,
  };
}
