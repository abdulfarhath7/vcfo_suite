import { getIncorporationPhases, type ChecklistItem } from '@/data/checklist';
import { responseFieldIdsForItem } from '@/lib/checklist-responses';
import type { EngagementChecklistState } from '@/lib/checklist-index';
import type {
  ChecklistItemStateSlice,
  StepApproval,
  StepApprovalState,
} from '@/lib/checklist-state-key';

/**
 * Three-party step approval, kept pure so the rules are testable without a
 * database:
 *
 *   lead requests approval  → pending_manager   (reuses reviewSource
 *                                                `lead_manager_request`)
 *   manager approves        → pending_client    (client is notified)
 *   client approves         → client_approved
 *   client asks for change  → change_requested  (step reopens for the lead)
 *
 * A manager REJECT is not modelled here. It keeps the existing reject/unlock
 * path untouched, which already reopens the step and re-locks everything after
 * it through `isChecklistStepSequentiallyComplete`.
 */

export type { StepApproval, StepApprovalState };

/** A step nobody has sent for approval yet reads as `none`, not as absent. */
export function approvalStateOf(slice?: ChecklistItemStateSlice | null): StepApprovalState {
  return slice?.approval?.state ?? 'none';
}

/** Only the client's turn enables their Approve button. */
export function isAwaitingClientApproval(slice?: ChecklistItemStateSlice | null): boolean {
  return approvalStateOf(slice) === 'pending_client';
}

export function isClientApproved(slice?: ChecklistItemStateSlice | null): boolean {
  return approvalStateOf(slice) === 'client_approved';
}

/**
 * States that mean the step is still moving between the three parties. A phase
 * cannot be called approved while any of its steps sits in one of these.
 */
const IN_FLIGHT: ReadonlySet<StepApprovalState> = new Set<StepApprovalState>([
  'pending_manager',
  'pending_client',
  'change_requested',
]);

export function isApprovalInFlight(slice?: ChecklistItemStateSlice | null): boolean {
  return IN_FLIGHT.has(approvalStateOf(slice));
}

/** Short label for the canonical status pill. Null when the step is untouched. */
export function stepApprovalLabel(slice?: ChecklistItemStateSlice | null): string | null {
  switch (approvalStateOf(slice)) {
    case 'pending_manager':
      return 'Awaiting your team';
    case 'pending_client':
      return 'Awaiting your approval';
    case 'client_approved':
      return 'Approved by you';
    case 'change_requested':
      return 'Change requested';
    default:
      return null;
  }
}

/** Why the client's Approve button is disabled. Null when it is enabled. */
export function clientApproveBlockedReason(
  slice?: ChecklistItemStateSlice | null,
): string | null {
  switch (approvalStateOf(slice)) {
    case 'pending_client':
      return null;
    case 'client_approved':
      return 'You have already approved this step.';
    case 'change_requested':
      return 'Your team is working on the change you asked for.';
    default:
      return 'Waiting for your team to submit and review this step.';
  }
}

export function buildManagerApproval(input: {
  approvedBy: string;
  approvedByName?: string;
  now: string;
  previous?: StepApproval;
}): StepApproval {
  return {
    ...input.previous,
    state: 'pending_client',
    managerApprovedAt: input.now,
    managerApprovedBy: input.approvedBy,
    managerApprovedByName: input.approvedByName?.trim() || undefined,
    // A fresh manager approval clears the last change request's trail.
    changeRequestedAt: undefined,
    changeRequestedBy: undefined,
    changeRequestedByName: undefined,
    changeNote: undefined,
  };
}

export function buildClientApproval(input: {
  approvedBy: string;
  approvedByName?: string;
  now: string;
  previous?: StepApproval;
}): StepApproval {
  return {
    ...input.previous,
    state: 'client_approved',
    clientApprovedAt: input.now,
    clientApprovedBy: input.approvedBy,
    clientApprovedByName: input.approvedByName?.trim() || undefined,
  };
}

export function buildChangeRequest(input: {
  requestedBy: string;
  requestedByName?: string;
  note: string;
  now: string;
  previous?: StepApproval;
}): StepApproval {
  return {
    ...input.previous,
    state: 'change_requested',
    changeRequestedAt: input.now,
    changeRequestedBy: input.requestedBy,
    changeRequestedByName: input.requestedByName?.trim() || undefined,
    changeNote: input.note.trim() || undefined,
    // The client's approval no longer stands once they ask for a change.
    clientApprovedAt: undefined,
    clientApprovedBy: undefined,
    clientApprovedByName: undefined,
  };
}

/**
 * The whole patch a change request writes.
 *
 * Pure on purpose: the rule that matters — reopening writes the SAME shape a
 * manager rejection writes — is the reason downstream steps re-lock correctly,
 * and it should be provable without a database. `reviewStatus: 'rejected'` plus
 * reopened fields is exactly what `isChecklistStepSequentiallyComplete` reads.
 */
export function changeRequestReopenPatch(input: {
  itemId: string;
  note: string;
  requestedBy: string;
  requestedByName?: string;
  now: string;
  previous?: StepApproval;
}): Partial<ChecklistItemStateSlice> {
  const note = input.note.trim();
  return {
    approval: buildChangeRequest({
      requestedBy: input.requestedBy,
      requestedByName: input.requestedByName,
      note,
      now: input.now,
      previous: input.previous,
    }),
    reviewStatus: 'rejected',
    reviewedAt: input.now,
    reviewedBy: input.requestedBy,
    rejectionNote: note,
    locked: true,
    unlockedFields: responseFieldIdsForItem(input.itemId),
  };
}

export interface ChecklistPhaseRef {
  id: string;
  title: string;
  items: ChecklistItem[];
}

/** The phase that owns a step, or null for a legacy item outside all four. */
export function phaseForStep(itemId: string): ChecklistPhaseRef | null {
  for (const phase of getIncorporationPhases()) {
    if (phase.items.some((item) => item.id === itemId)) {
      return { id: phase.id, title: phase.title, items: phase.items };
    }
  }
  return null;
}

/**
 * Steps in this phase that actually entered the approval flow.
 *
 * TODO(owner): "client-approvable" is derived from state, not from a hardcoded
 * list — a step counts once a manager has sent it to the client. That is what
 * keeps lead-only internal filing steps out of the phase check without naming
 * them anywhere. If you want a different granularity (say, every step with
 * `responsibleRole: 'client'`, which is only 5 of the 47), say so and this is
 * the one function to change.
 */
export function approvalTrackedSteps(
  phase: ChecklistPhaseRef,
  state: EngagementChecklistState,
): ChecklistItem[] {
  return phase.items.filter((item) => approvalStateOf(state[item.id]) !== 'none');
}

/**
 * True when every step this phase ever sent for approval is client-approved.
 *
 * Requires at least one approved step, so a phase where nothing was ever sent
 * does not read as complete and fire an email about work that never happened.
 */
export function isPhaseFullyClientApproved(
  phase: ChecklistPhaseRef,
  state: EngagementChecklistState,
): boolean {
  const tracked = approvalTrackedSteps(phase, state);
  if (tracked.length === 0) return false;
  return tracked.every((item) => isClientApproved(state[item.id]));
}

/**
 * Has this phase's completion email already gone out?
 *
 * The marker lives on whichever step closed the phase, so a double-click, a
 * re-render, or a client re-approving after a later change request all find it
 * and skip. Kept in `checklist_state` rather than a new table, per the same
 * rule that put the approval sub-state there.
 */
export function phaseCompletionAlreadyNotified(
  phase: ChecklistPhaseRef,
  state: EngagementChecklistState,
): boolean {
  return phase.items.some((item) =>
    Boolean(state[item.id]?.approval?.phaseCompletionNotifiedAt),
  );
}

/**
 * Decide, after a client approval, whether THIS transition completed the phase.
 * Returns the phase to announce, or null when there is nothing to send.
 */
export function phaseCompletedByApproval(
  itemId: string,
  state: EngagementChecklistState,
): ChecklistPhaseRef | null {
  const phase = phaseForStep(itemId);
  if (!phase) return null;
  if (phaseCompletionAlreadyNotified(phase, state)) return null;
  if (!isPhaseFullyClientApproved(phase, state)) return null;
  return phase;
}
