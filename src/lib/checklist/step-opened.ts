import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { sequentialLockMessage } from '@/lib/checklist/checklist-step-gate';
import { isDirectFlowStepComplete, PROPOSED_DIRECTORS_STEP_ID } from '@/lib/incorporation/pre-inc-direct-flow';

/** DR-03: the steps whose opening is announced to the client. */
export const ANNOUNCED_ON_OPEN_STEP_IDS: readonly string[] = [PROPOSED_DIRECTORS_STEP_ID];

type State = Record<string, ChecklistItemStateSlice | undefined> | undefined;

/**
 * True when `itemId` has just opened and the client has not been told: the step before it is
 * complete, this one is not, and no notice was stamped. The stamp makes the notice go out once.
 */
export function shouldAnnounceStepOpened(itemId: string, state: State): boolean {
  if (!ANNOUNCED_ON_OPEN_STEP_IDS.includes(itemId)) return false;
  const slice = state?.[itemId];
  if (slice?.openedNotifiedAt?.trim()) return false;
  if (isDirectFlowStepComplete(itemId, slice ?? null)) return false;
  return sequentialLockMessage(itemId, state) === null;
}

/**
 * DR-03: true when the Lead's step page shows "Send email" for the step-opened email. Only the
 * Lead (`intern`) sends it (owner decision), only on an announced step, and only while the step
 * is open and not yet complete.
 */
export function canSendStepOpenedEmail(role: string | null | undefined, itemId: string, state: State): boolean {
  if (role !== 'intern') return false;
  if (!ANNOUNCED_ON_OPEN_STEP_IDS.includes(itemId)) return false;
  if (isDirectFlowStepComplete(itemId, state?.[itemId] ?? null)) return false;
  return sequentialLockMessage(itemId, state) === null;
}
