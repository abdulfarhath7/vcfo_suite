'use client';

/**
 * The Incorporation section's selection (prototype `selPhase` / `selStep`), kept
 * outside React so `useStepActions().showStep(id)` — called from Home, Search,
 * the chat … — can select a step in the section without a shared context.
 */
import { useSyncExternalStore } from 'react';

export interface IncSelection {
  /** 1–3 (phase 4 lives in Registrations); null = the current phase. */
  phaseNo: number | null;
  stepId: string | null;
  /** bumps on every external select, so the section can flash / scroll */
  seq: number;
}

let sel: IncSelection = { phaseNo: null, stepId: null, seq: 0 };
const subs = new Set<() => void>();

export function setIncSelection(patch: Partial<Omit<IncSelection, 'seq'>>, bump = false) {
  sel = { ...sel, ...patch, seq: bump ? sel.seq + 1 : sel.seq };
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export function useIncSelection(): IncSelection {
  return useSyncExternalStore(subscribe, () => sel, () => sel);
}
