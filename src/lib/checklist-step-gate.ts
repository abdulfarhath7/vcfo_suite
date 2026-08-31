import {
  coerceStatusCode,
  getActiveCatalogItems,
  type ChecklistItem,
  type ChecklistResponsibleRole,
  type StatusCode,
} from '@/data/checklist';
import { isClientSubmissionLocked } from '@/lib/checklist-item-lock';
import { isReviewRejected } from '@/lib/checklist-item-review';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

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

function lockedMessage(title: string): string {
  return `This opens after ${title} is complete.`;
}

/**
 * Terminal complete for sequencing: N/A, delivered, approved/marked complete,
 * or client submit — not a save draft. Rejected / unlocked-for-correction
 * re-opens the step so later items re-lock.
 */
export function isChecklistStepSequentiallyComplete(
  status: StatusCode,
  slice?: ChecklistItemStateSlice | null,
): boolean {
  if (status === 'not-applicable') return true;
  if (isReviewRejected(slice)) return false;

  const reopened = (slice?.unlockedFields?.length ?? 0) > 0;
  if (reopened) return false;

  if (status === 'completed') return true;
  if (slice?.deliveredToClientAt?.trim()) return true;
  if (isClientSubmissionLocked(slice) && Boolean(slice?.clientSubmittedAt?.trim())) return true;
  return false;
}

export function gateDisplayStatus(
  status: StatusCode,
  gate: ChecklistStepGate | undefined,
): StatusCode {
  if (gate?.kind === 'locked' && status === 'overdue') return 'not-started';
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
    ),
  );
  const currentIndex = complete.findIndex((done) => !done);
  const blockerTitle =
    currentIndex >= 0 ? items[currentIndex]?.title : undefined;

  const out: Record<string, ChecklistStepGate> = {};
  items.forEach((item, index) => {
    if (complete[index] && (currentIndex < 0 || index < currentIndex)) {
      out[item.id] = {
        kind: 'done',
        canOpen: true,
        canEdit: viewer === 'staff',
        message: null,
      };
      return;
    }

    if (currentIndex < 0 || index === currentIndex) {
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
