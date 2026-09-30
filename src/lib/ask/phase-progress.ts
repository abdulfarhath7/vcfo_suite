import { coerceStatusCode, getIncorporationPhases } from '@/data/checklist';
import type { AskPhase } from '@/data/ask/schema';
import { gateActiveCatalog, getStepGate, isChecklistStepSequentiallyComplete } from '@/lib/checklist-step-gate';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

/**
 * Phase progress — "Where is my incorporation now?". Pure: phase and step
 * ids, titles and counts only. No people, dates or document data.
 *
 * Sequencing is the wizard's own gate (`gateActiveCatalog`), never a second
 * copy of it. Phases and their steps come from `getIncorporationPhases()`, so
 * rows follow each phase's itemIds order and legacy rows (`reg-2`, …) and the
 * "Operational Readiness" stage never appear.
 */

/** Client-facing name of each incorporation phase — the single source. */
export const PHASE_BY_ID: Record<string, AskPhase> = {
  'pre-inc-phase-1': 'SPICe+ Part A',
  'pre-inc-phase-2': 'SPICe+ Part B',
  'post-inc-phase-3': 'Post-incorporation',
  'registration-phase-4': 'Registration',
};

export interface PhaseProgressRow {
  /** Incorporation phase id, e.g. `pre-inc-phase-1`. */
  id: string;
  name: AskPhase;
  /** Terminal steps in this phase (completed or not applicable). */
  done: number;
  /** Active steps in this phase. */
  total: number;
  state: 'done' | 'current' | 'upcoming';
  currentStep?: { id: string; title: string; owner: 'client' | 'lead'; locked: boolean };
}

export interface PhaseProgressInput {
  state: Record<string, ChecklistItemStateSlice | undefined>;
}

export function buildPhaseProgress(input: PhaseProgressInput): PhaseProgressRow[] {
  const { state } = input;
  const gates = gateActiveCatalog(state, 'client');
  const rows: PhaseProgressRow[] = [];
  for (const phase of getIncorporationPhases()) {
    const name = PHASE_BY_ID[phase.id];
    if (!name) continue;
    const done = phase.items.filter((item) =>
      isChecklistStepSequentiallyComplete(coerceStatusCode(state[item.id]?.status), state[item.id]),
    ).length;
    const current = phase.items.find((item) => {
      const kind = getStepGate(gates, item.id).kind;
      return kind === 'active' || kind === 'waiting';
    });
    rows.push({
      id: phase.id,
      name,
      done,
      total: phase.items.length,
      state: current ? 'current' : done === phase.items.length ? 'done' : 'upcoming',
      ...(current
        ? {
            currentStep: {
              id: current.id,
              title: current.title,
              owner: current.responsibleRole === 'client' ? 'client' : 'lead',
              locked: getStepGate(gates, current.id).kind === 'locked',
            },
          }
        : {}),
    });
  }
  return rows;
}

/** The row the project is in, if any step is still open. */
export function currentPhaseRow(rows: readonly PhaseProgressRow[]): PhaseProgressRow | null {
  return rows.find((r) => r.state === 'current') ?? null;
}
