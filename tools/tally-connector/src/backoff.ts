/** Wait times after consecutive network errors: 5 s, 15 s, then 60 s for every later failure. */
const STEPS_MS = [5_000, 15_000, 60_000];

export function backoffDelay(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 0;
  return STEPS_MS[Math.min(consecutiveFailures, STEPS_MS.length) - 1];
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
