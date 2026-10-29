import { describe, expect, it } from 'vitest';
import { pastDays, trailingKnown } from '@/lib/metrics/home-trends';
import { clientDocsInAsOf, type DocRequestHistoryRow } from '@/lib/metrics/client-docs-trend';

const NOW = new Date('2026-10-29T04:30:00Z');
const periods = pastDays(NOW);
const at = (iso: string) => new Date(iso);

describe('clientDocsInAsOf', () => {
  it('counts requests answered before each day end', () => {
    const rows: DocRequestHistoryRow[] = [
      { status: 'fulfilled', createdAt: at('2026-10-20T05:00:00Z'), closedAt: at('2026-10-26T05:00:00Z') },
      { status: 'approved', createdAt: at('2026-10-20T05:00:00Z'), closedAt: at('2026-10-27T05:00:00Z') },
      { status: 'pending', createdAt: at('2026-10-20T05:00:00Z'), closedAt: null },
      { status: 'cancelled', createdAt: at('2026-10-20T05:00:00Z'), closedAt: at('2026-10-25T05:00:00Z') },
    ];
    // Days 25, 26, 27 and 28 Oct (India).
    expect(periods.map((p) => clientDocsInAsOf(rows, p))).toEqual([0, 1, 2, 2]);
  });

  it('ends the line where an answered request has no close time', () => {
    const rows: DocRequestHistoryRow[] = [
      { status: 'fulfilled', createdAt: at('2026-10-26T05:00:00Z'), closedAt: null },
      { status: 'fulfilled', createdAt: at('2026-10-20T05:00:00Z'), closedAt: at('2026-10-24T05:00:00Z') },
    ];
    const values = periods.map((p) => clientDocsInAsOf(rows, p));
    expect(values).toEqual([1, null, null, null]);
    expect(trailingKnown(values)).toEqual([]);
  });

  it('ignores an unstamped request created after the day end', () => {
    const rows: DocRequestHistoryRow[] = [{ status: 'fulfilled', createdAt: at('2026-10-29T01:00:00Z'), closedAt: null }];
    expect(periods.map((p) => clientDocsInAsOf(rows, p))).toEqual([0, 0, 0, 0]);
  });
});
