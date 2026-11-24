'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { FILL_MODE_STORAGE_KEY, FILL_START_EVENT, type FillMode } from '@/lib/ask/fill/types';

export { FILL_START_EVENT, type FillMode };

export type FillStartDetail = { runId: string; mode: FillMode };

const listeners = new Set<() => void>();
let memory: FillMode = 'manual';

/** The remembered mode; Manual when nothing is stored or storage is blocked. */
export function readFillMode(): FillMode {
  try {
    const stored = window.localStorage.getItem(FILL_MODE_STORAGE_KEY);
    if (stored === 'manual' || stored === 'auto') return stored;
  } catch {
    // Storage blocked: the choice lasts for this page load.
  }
  return memory;
}

export function writeFillMode(mode: FillMode): void {
  memory = mode;
  try {
    window.localStorage.setItem(FILL_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage blocked: kept in memory only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The mode and its setter, shared by every component that shows it. */
export function useFillMode(): [FillMode, (mode: FillMode) => void] {
  const mode = useSyncExternalStore(subscribe, readFillMode, () => 'manual' as FillMode);
  const set = useCallback((next: FillMode) => writeFillMode(next), []);
  return [mode, set];
}

export function dispatchFillStart(detail: FillStartDetail): void {
  window.dispatchEvent(new CustomEvent<FillStartDetail>(FILL_START_EVENT, { detail }));
}

/** Reads `answer.fill` from a chat answer without depending on the envelope's exact type. */
export function fillStartOf(answer: unknown): FillStartDetail | null {
  const fill = (answer as { fill?: { runId?: unknown; mode?: unknown } } | null)?.fill;
  if (!fill || typeof fill.runId !== 'string' || !fill.runId) return null;
  return { runId: fill.runId, mode: fill.mode === 'auto' ? 'auto' : 'manual' };
}
