'use client';

/**
 * The Registrations section's selected registration (prototype `selSop`), kept
 * outside React so Search and other sections can select one before scrolling
 * here (`selectRegistration(id)` then `go('registrations')`).
 */
import { useSyncExternalStore } from 'react';

interface RegSelection {
  stepId: string | null;
  seq: number;
}

let sel: RegSelection = { stepId: null, seq: 0 };
const subs = new Set<() => void>();

export function selectRegistration(stepId: string | null) {
  sel = { stepId, seq: sel.seq + 1 };
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export function useRegSelection(): RegSelection {
  return useSyncExternalStore(subscribe, () => sel, () => sel);
}
