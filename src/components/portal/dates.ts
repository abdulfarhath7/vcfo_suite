/**
 * Date helpers for the portal, matching the prototype's (a1_core.js) wording:
 * fmt "16 Oct", fmtY "16 Oct 2026", fmtL "Fri 16 Oct 2026", rel "in 3 days".
 * Every date is a plain ISO day (YYYY-MM-DD) read in UTC, so no time zone can
 * move a deadline by a day. "Today" is the real date in India (IST).
 */
export const DAY_MS = 864e5;
const IST_MS = 5.5 * 3600e3;

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Today's date in India as YYYY-MM-DD. */
export function todayIso(now: number = Date.now()): string {
  return new Date(now + IST_MS).toISOString().slice(0, 10);
}

/** ISO day → Date at UTC midnight. */
export const P = (s: string): Date => new Date(s.slice(0, 10) + 'T00:00:00Z');

export const iso = (y: number, m: number, d: number): string =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const addDays = (s: string, n: number): string => new Date(P(s).getTime() + n * DAY_MS).toISOString().slice(0, 10);

/** Whole days from today (IST) to `s`; negative when `s` is past. */
export function daysTo(s: string, today: string = todayIso()): number {
  return Math.round((P(s).getTime() - P(today).getTime()) / DAY_MS);
}

export const fmt = (s: string): string => {
  const d = P(s);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
};
export const fmtY = (s: string): string => {
  const d = P(s);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const fmtL = (s: string): string => {
  const d = P(s);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export const rel = (n: number): string =>
  n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;

/** Indian financial year that contains `s`: 2026-10-16 → { start: 2026, label: 'FY 2026-27', from: '2026-04-01', to: '2027-03-31' }. */
export function fyOf(s: string): { start: number; label: string; from: string; to: string } {
  const d = P(s);
  const start = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return { start, label: `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`, from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

/** End of an ISO day in India, as epoch ms (a filing due "16 Oct" is due until 23:59:59 IST). */
export function dueMs(s: string): number {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!, 23, 59, 59) - IST_MS;
}

/** [days, hours, minutes, seconds] in a span of ms (never negative). */
export function parts(ms: number): [number, number, number, number] {
  const v = Math.max(0, ms);
  return [Math.floor(v / DAY_MS), Math.floor((v % DAY_MS) / 3600e3), Math.floor((v % 3600e3) / 6e4), Math.floor((v % 6e4) / 1e3)];
}

/** "2 Sep" style label for a timestamp (ISO string with time). */
export function fmtStamp(ts: string | null | undefined): string {
  if (!ts) return '';
  return fmt(todayIso(new Date(ts).getTime()));
}
