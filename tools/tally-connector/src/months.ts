/** Splits an inclusive YYYY-MM-DD range into calendar-month pieces, so each Tally response stays small. */
export interface DateRange {
  from: string;
  to: string;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = ISO.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === s;
}

export function splitByMonth(from: string, to: string): DateRange[] {
  if (!isIsoDate(from) || !isIsoDate(to)) throw new Error(`Invalid date range ${from} to ${to}.`);
  if (from > to) throw new Error(`The range starts after it ends (${from} to ${to}).`);
  const out: DateRange[] = [];
  let start = from;
  while (start <= to) {
    const y = +start.slice(0, 4);
    const m = +start.slice(5, 7);
    const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const end = lastDay < to ? lastDay : to;
    out.push({ from: start, to: end });
    start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }
  return out;
}

/** 2026-04-01 -> 20260401, the format Tally wants in SVFROMDATE and SVTODATE. */
export function toTallyDate(iso: string): string {
  return iso.replace(/-/g, '');
}

/** 20260401 -> 2026-04-01; returns null for anything else. */
export function fromTallyDate(s: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return isIsoDate(iso) ? iso : null;
}
