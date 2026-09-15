import { approvalStateOf } from '@/lib/checklist-step-approval';
import type { EngagementChecklistState } from '@/lib/checklist-index';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

export { isLeadRequestPending } from '@/lib/checklist-item-review';

/**
 * Who may read what on a checklist step.
 *
 * A step has three readers and two hand-offs:
 *
 *   lead (drafts)  ──request approval──▶  firm (manager / admin)  ──accept──▶  client
 *
 * Until the lead asks for approval the step is their private draft: no other
 * role sees the answers, the uploads, or a progress tick for it. Until the
 * manager accepts, the client still sees nothing — an unapproved answer must
 * not reach them, and a rejected or change-requested step goes back behind
 * the same curtain while the lead reworks it.
 *
 * Kept pure and applied at the API boundary (see `checklistStateForViewer` in
 * the engagements repository) so every surface — step page, journey rail,
 * phase ticks, vault, command palette, dashboards — reads the same redacted
 * state and cannot disagree about what a viewer is allowed to see.
 */
export type ChecklistViewer = 'lead' | 'firm' | 'client';

export function checklistViewerForRole(role: string | null | undefined): ChecklistViewer {
  if (role === 'intern') return 'lead';
  if (role === 'client') return 'client';
  return 'firm';
}

/**
 * Lead → firm. The step reaches the manager / admin once the lead asks for
 * approval, delivers it, the client submits it, or it is marked complete / N/A.
 * A plain save — however many fields are filled — does not.
 */
export function isStepReleasedToFirm(slice?: ChecklistItemStateSlice | null): boolean {
  if (!slice) return false;
  if (slice.status === 'completed' || slice.status === 'not-applicable') return true;
  if (slice.reviewSource || slice.reviewStatus) return true;
  if (slice.clientSubmittedAt?.trim()) return true;
  if (slice.deliveredToClientAt?.trim()) return true;
  if (approvalStateOf(slice) !== 'none') return true;
  return false;
}

/**
 * Firm → client. A lead request is the client's to read only once the manager
 * has accepted it; while it is under review, rejected, or reopened by the
 * client's own change request it stays with the firm. Everything else follows
 * the existing release paths: the client's own submission, a delivery, an
 * accepted review, a completed / N/A mark, or an approval already in flight.
 */
export function isStepReleasedToClient(slice?: ChecklistItemStateSlice | null): boolean {
  if (!slice) return false;
  if (slice.status === 'not-applicable') return true;
  if (slice.reviewSource === 'client_submission') return true;
  if (slice.reviewSource === 'lead_manager_request') return slice.reviewStatus === 'accepted';
  if (slice.reviewStatus === 'accepted') return true;
  if (slice.deliveredToClientAt?.trim()) return true;
  if (slice.status === 'completed') return true;
  // `change_requested` is the client pulling the step back, not a release —
  // and it is what a redacted slice still carries, so it must read as closed.
  const approval = approvalStateOf(slice);
  return approval === 'pending_client' || approval === 'client_approved';
}

export function isStepReleasedTo(
  viewer: ChecklistViewer,
  slice?: ChecklistItemStateSlice | null,
): boolean {
  if (viewer === 'lead') return true;
  return viewer === 'firm' ? isStepReleasedToFirm(slice) : isStepReleasedToClient(slice);
}

/**
 * The slice a viewer is allowed to read. Unreleased steps lose the lead's
 * answers (and with them every upload). The client additionally loses the
 * review trail, so a request under review reads as a step the lead is still
 * working on — no lock, no submit stamp, no tick — while the approval
 * sub-state stays so "Change requested" still shows as their own.
 */
export function redactChecklistSliceForViewer(
  viewer: ChecklistViewer,
  slice: ChecklistItemStateSlice,
): ChecklistItemStateSlice {
  if (isStepReleasedTo(viewer, slice)) return slice;

  const {
    responses: _responses,
    notes: _notes,
    ...withoutDraft
  } = slice;
  if (viewer === 'firm') return withoutDraft;

  const {
    locked: _locked,
    unlockedFields: _unlocked,
    clientSubmittedAt: _submittedAt,
    reviewStatus: _reviewStatus,
    reviewSource: _reviewSource,
    reviewedAt: _reviewedAt,
    reviewedBy: _reviewedBy,
    rejectionNote: _rejectionNote,
    deliveredToClientAt: _deliveredAt,
    completedOn: _completedOn,
    assigneeId: _assigneeId,
    ...forClient
  } = withoutDraft;
  return {
    ...forClient,
    // A re-request after an accept keeps `completed`; the client must not
    // read that as done while the manager is deciding again.
    status: forClient.status === 'completed' ? 'in-progress' : forClient.status,
  };
}

export function redactChecklistStateForViewer(
  viewer: ChecklistViewer,
  state: EngagementChecklistState,
): EngagementChecklistState {
  if (viewer === 'lead') return state;
  const out: EngagementChecklistState = {};
  for (const [itemId, slice] of Object.entries(state)) {
    out[itemId] = redactChecklistSliceForViewer(viewer, slice);
  }
  return out;
}
