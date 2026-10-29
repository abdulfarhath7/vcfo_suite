/**
 * Company IDs on the client Home (G-07): the directors' DINs and the reveal
 * window of PAN / TAN. Pure, so the home repository, the reveal route and the
 * screen share one rule.
 *
 * DINs come from the proposed directors (`pre-15`, or the legacy Part A slots
 * on older engagements) through `readProposedDirectors`, the same accessor the
 * company snapshot uses. A DIN is a public MCA number, so it is not masked.
 */
import { displayName, readProposedDirectors, type StepStateMap } from '@/lib/incorporation/proposed-directors';

export interface DirectorDin {
  /** The director's name as the checklist holds it ("Asha Rao"). */
  name: string;
  din: string;
}

/** Every director with a DIN on file, in checklist order, one row per DIN. */
export function dinsFromState(state: StepStateMap): DirectorDin[] {
  const seen = new Set<string>();
  const out: DirectorDin[] = [];
  for (const d of readProposedDirectors(state)) {
    const din = (d.values.din ?? '').replace(/\s+/g, '').trim();
    if (!din || seen.has(din)) continue;
    seen.add(din);
    out.push({ name: displayName(d.values) || `Director ${d.index}`, din });
  }
  return out;
}

/** How long a revealed PAN or TAN stays on screen. */
export const IDENTIFIER_REVEAL_MS = 60_000;

/** When a reveal made at `now` closes, as an ISO time (the reveal response's `expiresAt`). */
export function revealExpiresAt(now: number = Date.now()): string {
  return new Date(now + IDENTIFIER_REVEAL_MS).toISOString();
}

/**
 * The end of a reveal window as a timestamp: the server's `expiresAt` when it
 * is a valid time inside the allowed window, otherwise `now` plus the window.
 * A clock-skewed or missing value never keeps a value on screen longer than
 * the window allows.
 */
export function revealUntil(expiresAt: string | undefined | null, now: number = Date.now()): number {
  const t = expiresAt ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(t) || t <= now) return now + IDENTIFIER_REVEAL_MS;
  return Math.min(t, now + IDENTIFIER_REVEAL_MS);
}

/** "0:42" for the seconds left until `until`. */
export function countdownLabel(until: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.ceil((until - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
