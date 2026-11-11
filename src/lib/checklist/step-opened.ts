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
