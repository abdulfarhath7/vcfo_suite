import { getItem } from '@/data/checklist';
import type { OwnershipType } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { sequentialLockMessage } from '@/lib/checklist/checklist-step-gate';
import { validateStepAgainstState } from '@/lib/checklist/checklist-step-validation';
import { isDirectFlowStep, isDirectFlowStepComplete } from '@/lib/incorporation/pre-inc-direct-flow';

/**
 * Can "Mark done" in the task drawer complete this checklist step (G-16)?
 *
 * The drawer never writes a step itself. It may only call the step's own completion
 * path, the direct-flow submit (`POST /api/engagements/:id/checklist/submit`), and only
 * when the checklist's own rules agree:
 *   - the step is a pre-incorporation direct-flow step (every other step completes
 *     through its form, a review or a delivery, so the drawer links to the form);
 *   - the caller is the project lead (the submit route takes a lead or a client);
 *   - the step is not already complete and not locked behind an earlier step
 *     (`sequentialLockMessage`);
 *   - the shared validator (`validateStepAgainstState`, the one the form and the
 *     submit route run) finds nothing missing.
 * The submit route validates again, so this is a preview, never the gate.
 */
export type StepCompletionVerdict =
  | { mode: 'done' }
  | { mode: 'locked'; message: string }
  | { mode: 'form'; reason: 'not_direct_flow' | 'role' | 'unknown_step' }
  | { mode: 'direct'; canComplete: boolean; missing: number };

export function stepCompletionVerdict(input: {
  stepId: string;
  role: string;
  state: Record<string, ChecklistItemStateSlice | undefined>;
  engagement?: {
    ownershipType?: OwnershipType;
    parentEntityName?: string | null;
    parentEntityAddress?: string | null;
    parentEntityRegistrationNumber?: string | null;
  } | null;
}): StepCompletionVerdict {
  const { stepId, role, state } = input;
  if (!getItem(stepId)) return { mode: 'form', reason: 'unknown_step' };
  if (!isDirectFlowStep(stepId)) return { mode: 'form', reason: 'not_direct_flow' };
  const slice = state[stepId];
  if (isDirectFlowStepComplete(stepId, slice)) return { mode: 'done' };
  if (role !== 'intern') return { mode: 'form', reason: 'role' };

  const lock = sequentialLockMessage(stepId, state);
  if (lock) return { mode: 'locked', message: lock };

  const validation = validateStepAgainstState({
    itemId: stepId,
    responses: slice?.responses ?? {},
    state: state as Parameters<typeof validateStepAgainstState>[0]['state'],
    engagement: input.engagement ?? null,
  });
  // A lead may edit every field of a direct-flow step, so every error blocks the submit.
  const missing = Object.keys(validation.errors).length;
  return { mode: 'direct', canComplete: missing === 0, missing };
}
