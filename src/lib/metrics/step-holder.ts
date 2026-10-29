/**
 * STEP HOLDER — who holds a step after a recorded change (`engagement_step_events.holder`,
 * migration 0028). The values are exactly `client`, `lead`, `manager` or `sbc`; null means
 * nobody holds it (the step is done or not applicable).
 *
 * The rule is the client home's (`buildIncorporationModel` in `lib/client-portal/step-model.ts`,
 * read by the home's "Waiting on you" and "With SBC"):
 *   - kind `you` or `prog` (the client's move, or the client has started it) → `client`;
 *   - kind `with` (the firm's move) → `manager` while the step awaits a manager decision
 *     (`isAwaitingManagerDecision`), else `lead`;
 *   - kind `up` or `next` (not open yet) → `sbc` (the firm holds the plan);
 *   - kind `done` → null.
 * A step outside the incorporation model (post-incorporation, registrations) follows the same
 * words from its own slice: done or not applicable → null; awaiting a manager → `manager`; a
 * client-owned step (`responsibleRole: 'client'`) → `client`; else `lead`.
 *
 * Pure: no React, no `db`. The client home agent reads the column for its trend lines, so the
 * words must not change.
 */

import { coerceStatusCode, getItem } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { buildIncorporationModel } from '@/lib/client-portal/step-model';
import { isAwaitingManagerDecision } from '@/lib/incorporation/pre-inc-direct-flow';

export type StepHolder = 'client' | 'lead' | 'manager' | 'sbc';

export const STEP_HOLDERS: readonly StepHolder[] = ['client', 'lead', 'manager', 'sbc'];

type State = Record<string, ChecklistItemStateSlice | undefined>;

/**
 * The holder of every step id given, from one `checklist_state` (built once, so a write that
 * changes several steps reads the incorporation model a single time).
 */
export function stepHolders(state: Record<string, unknown> | null | undefined, stepIds: string[]): Record<string, StepHolder | null> {
  const st = (state ?? {}) as State;
  const model = buildIncorporationModel(st);
  const out: Record<string, StepHolder | null> = {};
  for (const id of stepIds) {
    const slice = st[id];
    const step = model.byId[id];
    if (step) {
      if (step.kind === 'done') out[id] = null;
      else if (step.kind === 'you' || step.kind === 'prog') out[id] = 'client';
      else if (step.kind === 'with') out[id] = isAwaitingManagerDecision(id, slice) ? 'manager' : 'lead';
      else out[id] = 'sbc';
      continue;
    }
    const status = coerceStatusCode(slice?.status);
    if (status === 'completed' || status === 'not-applicable') out[id] = null;
    else if (isAwaitingManagerDecision(id, slice)) out[id] = 'manager';
    else if (getItem(id)?.responsibleRole === 'client') out[id] = 'client';
    else out[id] = 'lead';
  }
  return out;
}

/** The holder of one step (see `stepHolders`). */
export function stepHolderOf(state: Record<string, unknown> | null | undefined, stepId: string): StepHolder | null {
  return stepHolders(state, [stepId])[stepId] ?? null;
}
