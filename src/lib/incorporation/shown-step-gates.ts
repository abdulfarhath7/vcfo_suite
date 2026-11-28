import { getActiveCatalogItems, type ChecklistItem, type StatusCode } from '@/data/checklist';
import { deriveChecklistDisplayStatus } from '@/lib/checklist/checklist-display-status';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { gateDisplayStatus, getStepGate, type ChecklistStepGate } from '@/lib/checklist/checklist-step-gate';

/**
 * ONE "DONE" FOR EVERY STEP MARK. The sequential gate marks a step done only when every step
 * before it is complete too, while the step page's head shows the step's own status. A step whose
 * own status is Done (a board resolution step the manager accepted, say) therefore showed Done in
 * its head and an empty node in the phase rail, the record's step card and the "x of y" counts,
 * because an earlier step was still open.
 *
 * These helpers keep the gate for what the viewer may do (`canOpen`, `canEdit`, the message) and
 * only turn its `kind` into 'done' when the step's display status, the same one the head shows,
 * is 'completed'. The gating rules themselves (`src/lib/checklist/`) are unchanged.
 */

/** The gate a step's marks show, given the status its head shows. */
export function shownDoneGate(gate: ChecklistStepGate, status: StatusCode): ChecklistStepGate {
  if (gate.kind === 'done' || status !== 'completed') return gate;
  return { ...gate, kind: 'done' };
}

/** The gates of the active catalog as the marks show them (the step head's Done counts as done). */
export function shownStepGates(
  gates: Record<string, ChecklistStepGate>,
  state: Record<string, ChecklistItemStateSlice | undefined>,
  items: readonly ChecklistItem[] = getActiveCatalogItems(),
): Record<string, ChecklistStepGate> {
  const out: Record<string, ChecklistStepGate> = { ...gates };
  for (const item of items) {
    if (!gates[item.id]) continue;
    const gate = getStepGate(gates, item.id);
    const status = gateDisplayStatus(deriveChecklistDisplayStatus(item.id, item, state[item.id]), gate);
    out[item.id] = shownDoneGate(gate, status);
  }
  return out;
}
