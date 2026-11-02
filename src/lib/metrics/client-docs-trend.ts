import { countKnown, type TrendPeriod } from '@/lib/metrics/home-trends';

/**
 * CLIENT HOME "DOCUMENTS IN" TREND (R-18, C-023) — the pure part.
 *
 * The client home tile "Documents in" shows answered requests out of all requests. Its trend
 * line follows the answered count. A request counts as answered at a day end when it is
 * fulfilled or approved now and its `closed_at` (migration 0027) is before that day end.
 *
 * What cannot be known ends the line: a request that is answered now but has no `closed_at`
 * (it was answered before the column existed) and was created before the day end makes that
 * day unknown, so `trailingKnown` drops it and every earlier day. A request that is open now is
 * counted as not answered; the only way back to open is the five-second Undo after an upload,
 * which also clears `closed_at`.
 */

/** A document request as the trend reads it. */
export interface DocRequestHistoryRow {
  status: string;
  closedAt: Date | null;
  createdAt: Date;
}

/** Statuses the live tile counts as answered (`getClientHome` requestCounts). */
const ANSWERED: ReadonlySet<string> = new Set(['fulfilled', 'approved']);

/** Answered requests at the end of `period`, or `null` when that cannot be rebuilt. */
export function clientDocsInAsOf(rows: DocRequestHistoryRow[], period: TrendPeriod): number | null {
  return countKnown(rows, (r) => {
    if (r.createdAt >= period.end) return false;
    if (!ANSWERED.has(r.status)) return false;
    if (!r.closedAt) return null;
    return r.closedAt < period.end;
  });
}
