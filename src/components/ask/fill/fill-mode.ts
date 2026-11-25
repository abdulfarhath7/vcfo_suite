'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { FILL_MODE_STORAGE_KEY, FILL_START_EVENT, type FillMode } from '@/lib/ask/fill/types';
import { prefersReducedMotion } from './type-into';

export { FILL_START_EVENT, type FillMode };

/**
 * How fast the browser player fills a page: "watch" moves the ghost cursor to each field and types
 * it; "instant" sets every value at once. Remembered per person beside the Manual / Auto mode.
 */
export type FillSpeed = 'watch' | 'instant';
export const FILL_SPEED_STORAGE_KEY = 'vcfo.ask.fillSpeed';

/**
 * `mode` is how the server runs the fill. `autoAccept` marks Auto with "Watch it fill": the server
 * run is browser-driven (Manual on the server), and the player saves each step itself as a draft.
 */
export type FillStartDetail = { runId: string; mode: FillMode; autoAccept?: boolean };

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

let speedMemory: FillSpeed = 'watch';
const speedListeners = new Set<() => void>();

/** The remembered speed; "Watch it fill" when nothing is stored or storage is blocked. */
export function readFillSpeed(): FillSpeed {
  try {
    const stored = window.localStorage.getItem(FILL_SPEED_STORAGE_KEY);
    if (stored === 'watch' || stored === 'instant') return stored;
  } catch {
    // Storage blocked: the choice lasts for this page load.
  }
  return speedMemory;
}

export function writeFillSpeed(speed: FillSpeed): void {
  speedMemory = speed;
  try {
    window.localStorage.setItem(FILL_SPEED_STORAGE_KEY, speed);
  } catch {
    // Storage blocked: kept in memory only.
  }
  for (const listener of speedListeners) listener();
}

function subscribeSpeed(listener: () => void) {
  speedListeners.add(listener);
  return () => {
    speedListeners.delete(listener);
  };
}

/** The speed and its setter, shared by the composer chip and the fill rail. */
export function useFillSpeed(): [FillSpeed, (speed: FillSpeed) => void] {
  const speed = useSyncExternalStore(subscribeSpeed, readFillSpeed, () => 'watch' as FillSpeed);
  const set = useCallback((next: FillSpeed) => writeFillSpeed(next), []);
  return [speed, set];
}

/** The speed the player uses now: always instant under reduced motion. */
export function effectiveFillSpeed(): FillSpeed {
  return prefersReducedMotion() ? 'instant' : readFillSpeed();
}

/**
 * The mode the server is asked to run. Auto with "Watch it fill" is driven by the browser player
 * (the server's Manual run, accepted by the player); only Auto with "Fill instantly" (or Auto under
 * reduced motion) runs as the background server job.
 */
export function serverFillMode(mode: FillMode = readFillMode(), speed: FillSpeed = effectiveFillSpeed()): FillMode {
  return mode === 'auto' && speed === 'instant' ? 'auto' : 'manual';
}

/**
 * Starts the live player. A browser-driven run started while the chip says Auto accepts each page
 * by itself, unless the caller already said otherwise.
 */
export function dispatchFillStart(detail: FillStartDetail): void {
  const full: FillStartDetail = {
    ...detail,
    autoAccept: detail.autoAccept ?? (detail.mode === 'manual' && readFillMode() === 'auto'),
  };
  window.dispatchEvent(new CustomEvent<FillStartDetail>(FILL_START_EVENT, { detail: full }));
}

/** Reads `answer.fill` from a chat answer without depending on the envelope's exact type. */
export function fillStartOf(answer: unknown): FillStartDetail | null {
  const fill = (answer as { fill?: { runId?: unknown; mode?: unknown } } | null)?.fill;
  if (!fill || typeof fill.runId !== 'string' || !fill.runId) return null;
  return { runId: fill.runId, mode: fill.mode === 'auto' ? 'auto' : 'manual' };
}
