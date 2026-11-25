'use client';

import { useSyncExternalStore } from 'react';
import type { FillRunView } from '@/lib/ask/fill/types';
import type { FillMode } from './fill-mode';

/**
 * The live fill on screen, shared by the player (which drives it), the chat rail (which shows
 * it and carries Accept and Stop) and the ghost cursor. A small module store, because the
 * player sits in the shell while the rail renders inside the Ask thread.
 */
export type FillPhase =
  | 'loading'
  | 'opening'
  | 'typing'
  | 'waiting'
  | 'saving'
  | 'auto'
  | 'done'
  | 'stopped'
  | 'error';

export type FillCursor = { x: number; y: number; visible: boolean; pulse: number };

export type FillState = {
  runId: string;
  mode: FillMode;
  view: FillRunView | null;
  phase: FillPhase;
  message: string | null;
  /** Fields typed so far on each step during this run (the rail's live count). */
  typed: Record<string, number>;
  cursor: FillCursor;
};

export type FillActions = { accept?: () => void; stop?: () => void; retry?: () => void; dismiss?: () => void };

let state: FillState | null = null;
let actions: FillActions = {};
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export function getFillState(): FillState | null {
  return state;
}

export function startFillState(runId: string, mode: FillMode): void {
  state = {
    runId,
    mode,
    view: null,
    phase: 'loading',
    message: null,
    typed: {},
    cursor: { x: 0, y: 0, visible: false, pulse: 0 },
  };
  emit();
}

export function patchFillState(patch: Partial<FillState> | ((s: FillState) => Partial<FillState>)): void {
  if (!state) return;
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  emit();
}

export function moveFillCursor(cursor: Partial<FillCursor>): void {
  patchFillState((s) => ({ cursor: { ...s.cursor, ...cursor } }));
}

export function clearFillState(): void {
  state = null;
  actions = {};
  emit();
}

export function setFillActions(next: FillActions): void {
  actions = next;
  if (state) {
    state = { ...state };
    emit();
  }
}

export function fillActions(): FillActions {
  return actions;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFillState(): FillState | null {
  return useSyncExternalStore(subscribe, getFillState, () => null);
}
