import {
  coerceStatusCode,
  getActiveCatalogItems,
  type ChecklistItem,
  type ChecklistResponsibleRole,
  type StatusCode,
} from '@/data/checklist';
import { isClientSubmissionLocked } from '@/lib/checklist/checklist-item-lock';
import { isLeadRequestPending, isReviewRejected } from '@/lib/checklist/checklist-item-review';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import {
  isDirectFlowStep,
  isDirectFlowStepComplete,
  isWaitingOnLead,
} from '@/lib/incorporation/pre-inc-direct-flow';

export type ChecklistStepGateKind = 'done' | 'active' | 'waiting' | 'locked';
export type ChecklistGateViewer = 'client' | 'staff' | 'intern';

export interface ChecklistStepGate {
  kind: ChecklistStepGateKind;
  /** Title of the current incomplete step that blocks this one. */
  blockedByTitle?: string;
  canOpen: boolean;
  canEdit: boolean;
  /** User-facing copy. Never "access denied". */
  message: string | null;
}

const WAITING_CLIENT = 'Waiting on the client…';
const WAITING_LEAD = 'Waiting on your project lead…';
const WAITING_MANAGER = 'Waiting on your manager…';
const WAITING_YOUR_APPROVAL = 'Waiting on your approval…';
const WAITING_FILLERS = 'Waiting on the client or the project lead…';

export function checklistGateViewerFrom(
  variant: 'admin' | 'client',
  role?: string | null,
): ChecklistGateViewer {
  if (variant === 'client' || role === 'client') return 'client';
  if (role === 'intern') return 'intern';
  return 'staff';
}

/** Intern leads can open and fill any catalog step; sequence `kind` is unchanged. */
function internViewerAccess(gate: ChecklistStepGate): ChecklistStepGate {
  return {
    ...gate,
    canOpen: true,
    canEdit: true,
    message: gate.kind === 'locked' ? null : gate.message,
  };
}

function ownerParty(item: ChecklistItem): ChecklistResponsibleRole {
  return item.responsibleRole === 'client' ? 'client' : 'intern';
}

function viewerOwnsStep(item: ChecklistItem, viewer: ChecklistGateViewer): boolean {
  const owner = ownerParty(item);
  return viewer === 'client' ? owner === 'client' : owner === 'intern';
}

function waitingMessage(item: ChecklistItem): string {
  return ownerParty(item) === 'client' ? WAITING_CLIENT : WAITING_LEAD;
}

/** A lead request sits with the manager: nobody else's turn, whoever is looking. */
function pendingApprovalMessage(viewer: ChecklistGateViewer): string {
  if (viewer === 'intern') return WAITING_MANAGER;
  if (viewer === 'staff') return WAITING_YOUR_APPROVAL;
  return WAITING_LEAD;
}

function lockedMessage(title: string): string {
  return `This opens after ${title} is complete.`;
}

/**
 * Terminal complete for sequencing: N/A, delivered, approved/marked complete,
 * or client submit — not a save draft. Rejected / unlocked-for-correction
 * re-opens the step so later items re-lock. A lead's request for approval is
 * not complete either: the tick, and the next step, wait for the manager.
 */
export function isChecklistStepSequentiallyComplete(
  status: StatusCode,
  slice?: ChecklistItemStateSlice | null,
  itemId?: string,
): boolean {
  if (status === 'not-applicable') return true;
  // Pre-incorporation direct flow: Submit completes the step; old approval-era
  // states are read through the policy module (section 3.12 of the spec).
  if (itemId && isDirectFlowStep(itemId)) {
    return isDirectFlowStepComplete(itemId, { ...(slice ?? {}), status });
  }
  if (isReviewRejected(slice)) return false;
  if (isLeadRequestPending(slice)) return false;

  const reopened = (slice?.unlockedFields?.length ?? 0) > 0;
  if (reopened) return false;

  if (status === 'completed') return true;
  if (slice?.deliveredToClientAt?.trim()) return true;
  if (isClientSubmissionLocked(slice) && Boolean(slice?.clientSubmittedAt?.trim())) return true;
  return false;
}

/**
 * The current direct-flow step: the client and the lead both fill it. After a
 * client submit that stopped on lead-only fields it waits on the lead.
 */
function directFlowCurrentGate(viewer: ChecklistGateViewer, waitingOnLead: boolean): ChecklistStepGate {
  if (viewer === 'intern') return { kind: 'active', canOpen: true, canEdit: true, message: null };
  if (waitingOnLead) {
    return { kind: 'waiting', canOpen: true, canEdit: false, message: WAITING_LEAD };
  }
  if (viewer === 'client') return { kind: 'active', canOpen: true, canEdit: true, message: null };
  return { kind: 'waiting', canOpen: true, canEdit: false, message: WAITING_FILLERS };
}

export function gateDisplayStatus(
  status: StatusCode,
  gate: ChecklistStepGate | undefined,
): StatusCode {
  if (gate?.kind === 'locked' && status === 'overdue') return 'not-started';
  // A re-requested step keeps `completed` from its earlier accept; while the
  // manager decides again it is not done, and the badge must not say so.
  if (gate?.kind === 'waiting' && status === 'completed') return 'in-progress';
  return status;
}

export function gateChecklistSteps(params: {
  items: readonly ChecklistItem[];
  state?: Record<string, ChecklistItemStateSlice | undefined>;
  viewer: ChecklistGateViewer;
}): Record<string, ChecklistStepGate> {
  const { items, state = {}, viewer } = params;
  const complete = items.map((item) =>
    isChecklistStepSequentiallyComplete(
      coerceStatusCode(state[item.id]?.status),
      state[item.id],
      item.id,
    ),
  );
  const currentIndex = complete.findIndex((done) => !done);
  const blockerTitle =
    currentIndex >= 0 ? items[currentIndex]?.title : undefined;

  const out: Record<string, ChecklistStepGate> = {};
  items.forEach((item, index) => {
    // N/A is settled wherever it sits in the sequence (an independent
    // company's board-resolution steps, say) — never "opens after".
    const notApplicable = state[item.id]?.status === 'not-applicable';
    const directFlow = isDirectFlowStep(item.id);
    if (complete[index] && (notApplicable || currentIndex < 0 || index < currentIndex)) {
      out[item.id] = {
        kind: 'done',
        canOpen: true,
        // A manager reads a submitted direct-flow step; reopening is separate.
        canEdit: viewer === 'staff' && !directFlow,
        message: null,
      };
      return;
    }

    if (directFlow && (currentIndex < 0 || index === currentIndex)) {
      out[item.id] = directFlowCurrentGate(viewer, isWaitingOnLead(item.id, state[item.id]));
      return;
    }

    if (directFlow && viewer === 'client') {
      // The client may read ahead; the form stays read-only until it opens.
      out[item.id] = {
        kind: 'locked',
        blockedByTitle: blockerTitle,
        canOpen: true,
        canEdit: false,
        message: blockerTitle ? lockedMessage(blockerTitle) : 'This opens after the previous step is complete.',
      };
      return;
    }

    if (currentIndex < 0 || index === currentIndex) {
      if (isLeadRequestPending(state[item.id])) {
        out[item.id] = {
          kind: 'waiting',
          canOpen: true,
          canEdit: false,
          message: pendingApprovalMessage(viewer),
        };
        return;
      }
      const owns = viewerOwnsStep(item, viewer);
      if (owns) {
        out[item.id] = {
          kind: 'active',
          canOpen: true,
          canEdit: true,
          message: null,
        };
      } else {
        out[item.id] = {
          kind: 'waiting',
          canOpen: true,
          canEdit: false,
          message: waitingMessage(item),
        };
      }
      return;
    }

    out[item.id] = {
      kind: 'locked',
      blockedByTitle: blockerTitle,
      canOpen: false,
      canEdit: false,
      message: blockerTitle ? lockedMessage(blockerTitle) : 'This opens after the previous step is complete.',
    };
  });

  if (viewer === 'intern') {
    for (const id of Object.keys(out)) {
      out[id] = internViewerAccess(out[id]!);
    }
  }

  return out;
}

export function gateActiveCatalog(
  state: Record<string, ChecklistItemStateSlice | undefined> | undefined,
  viewer: ChecklistGateViewer,
): Record<string, ChecklistStepGate> {
  return gateChecklistSteps({
    items: getActiveCatalogItems(),
    state,
    viewer,
  });
}

export function getStepGate(
  gates: Record<string, ChecklistStepGate>,
  itemId: string,
): ChecklistStepGate {
  // Fail closed. An id missing from the map means the gate was never computed
  // for it, which is not evidence the step is open. UI-only defence in depth —
  // the server still decides through `sequentialLockMessage`.
  return (
    gates[itemId] ?? {
      kind: 'locked',
      canOpen: false,
      canEdit: false,
      message: 'This opens after the previous step is complete.',
    }
  );
}

/** Server-side: user-facing reason if this catalog item is still locked. */
export function sequentialLockMessage(
  itemId: string,
  state: Record<string, ChecklistItemStateSlice | undefined> | undefined,
): string | null {
  const catalog = getActiveCatalogItems();
  if (!catalog.some((item) => item.id === itemId)) return null;
  const gate = gateChecklistSteps({ items: catalog, state, viewer: 'staff' })[itemId];
  return gate?.kind === 'locked' ? gate.message : null;
}

/**
 * A save refused because the step is still behind the sequential lock. Routes answer it
 * with 409 and the lock message.
 */
export class ChecklistStepLockedError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ChecklistStepLockedError';
  }
}

type StepPatchLike = Pick<
  ChecklistItemStateSlice,
  'status' | 'reviewStatus' | 'deliveredToClientAt' | 'completedOn'
>;

/**
 * Server-side, for staff saves: the lock message when this patch would move a locked step
 * forward, else null.
 *
 * A locked step is not late, not in progress and not done for anyone. Staff may still save
 * answers, notes, assignments and drafts on it ahead of time (a lead prepares a later step),
 * so only these moves are refused:
 *   - a status change to in progress, awaiting client, overdue or completed;
 *   - a request for approval or an accept (`reviewStatus` reviewing or accepted, when it
 *     was not already so);
 *   - a new delivery or completion stamp.
 * These stay allowed: moving the status back to not started, marking the step not
 * applicable (a manager settles a parent-entity step by hand), a reject, and a reopen of a
 * step that already reads complete (its status goes back to in progress).
 */
export function staffStatusLockMessage(
  itemId: string,
  patch: Partial<StepPatchLike>,
  state: Record<string, ChecklistItemStateSlice | undefined> | undefined,
): string | null {
  const lock = sequentialLockMessage(itemId, state);
  if (!lock) return null;
  const slice = state?.[itemId];
  const prevStatus = coerceStatusCode(slice?.status);

  const next = patch.status;
  const reopen =
    next === 'in-progress' && isChecklistStepSequentiallyComplete(prevStatus, slice, itemId);
  const statusMoves =
    next !== undefined &&
    next !== prevStatus &&
    next !== 'not-started' &&
    next !== 'not-applicable' &&
    !reopen;
  const review = patch.reviewStatus;
  const reviewMoves =
    (review === 'reviewing' || review === 'accepted') && review !== slice?.reviewStatus;
  const stamped =
    (Boolean(patch.deliveredToClientAt?.trim()) && !slice?.deliveredToClientAt?.trim()) ||
    (Boolean(patch.completedOn?.trim()) && !slice?.completedOn?.trim());

  return statusMoves || reviewMoves || stamped ? lock : null;
}
