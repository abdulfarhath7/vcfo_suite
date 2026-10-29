import { describe, expect, it } from 'vitest';
import { pastDays, trailingKnown } from '@/lib/metrics/home-trends';
import {
  holderChanges,
  holderCountsAsOf,
  indexHolderEvents,
  modelStepIds,
  openRequestsAsOf,
  type HolderHistoryEvent,
} from '@/lib/metrics/client-holder-trend';
import { stepHolders } from '@/lib/metrics/step-holder';

const NOW = new Date('2026-10-29T04:30:00Z');
// Days 25, 26, 27 and 28 Oct (India); each ends at 18:30Z.
const periods = pastDays(NOW);
const at = (iso: string) => new Date(iso);

describe('holderCountsAsOf', () => {
  const ids = ['a', 'b', 'c'];
  const base: HolderHistoryEvent[] = [
    { stepId: 'a', holder: 'client', at: at('2026-10-25T05:00:00Z') },
    { stepId: 'b', holder: 'sbc', at: at('2026-10-25T05:00:00Z') },
    { stepId: 'c', holder: 'lead', at: at('2026-10-25T05:00:00Z') },
  ];
  const since = at('2026-10-25T05:00:00Z');

  it('counts client and SBC holders at each day end from the last row before it', () => {
    const events = indexHolderEvents([
      ...base,
      { stepId: 'a', holder: 'manager', at: at('2026-10-26T06:00:00Z') },
      { stepId: 'b', holder: 'client', at: at('2026-10-27T06:00:00Z') },
      { stepId: 'c', holder: null, at: at('2026-10-28T06:00:00Z') },
    ]);
    const counts = periods.map((p) => holderCountsAsOf({ stepIds: ids, events, since, period: p }));
    expect(counts).toEqual([
      { client: 1, withSbc: 1 },
      { client: 0, withSbc: 2 },
      { client: 1, withSbc: 2 },
      { client: 1, withSbc: 1 },
    ]);
  });

  it('knows nothing before the baseline or for a step with no row', () => {
    const events = indexHolderEvents(base);
    const late = at('2026-10-27T05:00:00Z');
    const values = periods.map((p) => holderCountsAsOf({ stepIds: ids, events, since: late, period: p }));
    expect(values.slice(0, 2)).toEqual([null, null]);
    expect(holderCountsAsOf({ stepIds: [...ids, 'd'], events, since, period: periods[3]! })).toBeNull();
    expect(holderCountsAsOf({ stepIds: ids, events, since: null, period: periods[3]! })).toBeNull();
    expect(trailingKnown([null, null, 1, 1])).toEqual([1, 1]);
  });
});

describe('openRequestsAsOf', () => {
  it('counts pending requests and those closed after the day end', () => {
    const rows = [
      { status: 'pending', closedAt: null, createdAt: at('2026-10-20T05:00:00Z') },
      { status: 'fulfilled', closedAt: at('2026-10-27T05:00:00Z'), createdAt: at('2026-10-20T05:00:00Z') },
      { status: 'pending', closedAt: null, createdAt: at('2026-10-29T01:00:00Z') },
    ];
    expect(periods.map((p) => openRequestsAsOf(rows, p))).toEqual([2, 2, 1, 1]);
  });

  it('is unknown when a closed request has no close time', () => {
    const rows = [{ status: 'cancelled', closedAt: null, createdAt: at('2026-10-20T05:00:00Z') }];
    expect(openRequestsAsOf(rows, periods[0]!)).toBeNull();
  });
});

describe('holderChanges', () => {
  it('writes a baseline row for every model step, with the holder of the next state', () => {
    const next = {};
    const rows = holderChanges({}, next, new Set(), true);
    const ids = modelStepIds(next);
    expect(rows.map((r) => r.stepId).sort()).toEqual([...ids].sort());
    const holders = stepHolders(next, ids);
    for (const r of rows) {
      expect(r.from).toBe(r.to);
      expect(r.holder).toBe(holders[r.stepId] ?? null);
    }
  });

  it('adds nothing when no holder moves and skips steps the status diff carries', () => {
    expect(holderChanges({}, {}, new Set(), false)).toEqual([]);
    const ids = modelStepIds({});
    expect(holderChanges({}, {}, new Set(ids), true)).toEqual([]);
  });
});
