/**
 * Per-person limits on two-step codes (G-25), kept in process memory.
 *
 * - Failed codes: ten wrong codes in ten minutes locks the code step for that
 *   person for the rest of the window. A wrong code is only reachable after the
 *   password was accepted, so this slows guessing without a lockout anyone can
 *   trigger from the email address alone.
 * - Replays: a code whose step counter was already used for that person is
 *   refused, so a code read over someone's shoulder cannot be used twice.
 *
 * Like `src/lib/api/rate-limit.ts`, this is per instance: with several App
 * Runner instances each keeps its own count. That is acceptable for a 10^6
 * code space and three valid codes at a time; a shared store would be the next
 * step if the instance count grows.
 */

const FAIL_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 10;

const fails = new Map<string, { count: number; resetAt: number }>();
const lastCounter = new Map<string, number>();

export function isTotpLocked(userId: string, now = Date.now()): boolean {
  const entry = fails.get(userId);
  if (!entry || now >= entry.resetAt) return false;
  return entry.count >= MAX_FAILS;
}

export function recordTotpFailure(userId: string, now = Date.now()): void {
  const entry = fails.get(userId);
  if (!entry || now >= entry.resetAt) {
    fails.set(userId, { count: 1, resetAt: now + FAIL_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/**
 * Records a matched step counter. Returns false when that counter (or a later
 * one) was already used by this person, which means the code is a replay.
 */
export function acceptTotpCounter(userId: string, counter: number): boolean {
  const prev = lastCounter.get(userId);
  if (prev !== undefined && counter <= prev) return false;
  lastCounter.set(userId, counter);
  fails.delete(userId);
  return true;
}

/** Test helper: forget every count. */
export function resetTotpGuard(): void {
  fails.clear();
  lastCounter.clear();
}
