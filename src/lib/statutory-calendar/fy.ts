/**
 * Financial-year keys for the statutory calendar. A key is the Indian financial year written the
 * way the firm writes it, "2026-27", and runs from 1 April to 31 March. Pure, so the browser, the
 * routes and the tests share it.
 */

export interface FyBounds {
  /** "2026-27" */
  key: string;
  /** "FY 2026-27" */
  label: string;
  /** "2026-04-01" */
  start: string;
  /** "2027-03-31" */
  end: string;
  /** 2026, the calendar year the financial year starts in. */
  startYear: number;
}

const FY_KEY = /^(\d{4})-(\d{2})$/;

/** True for a well-formed key whose second half is the year after the first ("2026-27"). */
export function isFyKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = FY_KEY.exec(value);
  if (!match) return false;
  const start = Number(match[1]);
  return start >= 2000 && start <= 2098 && (start + 1) % 100 === Number(match[2]);
}

export function fyKeyFromStartYear(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** The financial year that contains an ISO date ("2026-11-11" is in "2026-27"). */
export function fyKeyForIso(iso: string): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  return fyKeyFromStartYear(month >= 4 ? year : year - 1);
}

export function fyBounds(key: string): FyBounds {
  if (!isFyKey(key)) throw new Error(`invalid financial year: ${key}`);
  const startYear = Number(key.slice(0, 4));
  return {
    key,
    label: `FY ${key}`,
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
    startYear,
  };
}

/** The years an admin may import for: last year, this year and the next two. */
export function importableFyKeys(todayIso: string): string[] {
  const current = Number(fyKeyForIso(todayIso).slice(0, 4));
  return [current - 1, current, current + 1, current + 2].map(fyKeyFromStartYear);
}

/** Today's date in India as an ISO date, so a server in UTC picks the same financial year. */
export function todayIsoInIndia(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
