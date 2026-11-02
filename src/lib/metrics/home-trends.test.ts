import { describe, expect, it } from 'vitest';
import {
  clientDueSoonAsOf,
  engagementLiveAt,
  filedAsOf,
  istDayEnd,
  messagesFailedAsOf,
  pastDays,
  pastMonthEnds,
  rollingDaySum,
  superFilingsDueAsOf,
  trailingKnown,
  withSnapshots,
  type FilingHistoryRow,
  type TrendPeriod,
} from './home-trends';

// 29 Oct 2026, 10:00 India time.
const NOW = new Date('2026-10-29T04:30:00Z');
const day = (ymd: string): TrendPeriod => ({ ymd, end: istDayEnd(ymd) });

function filing(over: Partial<FilingHistoryRow> = {}): FilingHistoryRow {
  return {
    id: 'f1',
    engagementId: 'e1',
    dueDate: '2026-10-30',
    status: 'upcoming',
    filedOn: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    ...over,
  };
}

describe('periods', () => {
  it('lists the 30 India days before today, one per day, oldest first', () => {
    const days = pastDays(NOW);
    expect(days).toHaveLength(30);
    expect(days[0]!.ymd).toBe('2026-09-29');
    expect(days[29]!.ymd).toBe('2026-10-28');
    expect(pastDays(NOW, 4).map((p) => p.ymd)).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
    // A day ends at midnight India time, 18:30 UTC.
    expect(days[29]!.end.toISOString()).toBe('2026-10-28T18:30:00.000Z');
    // No day is skipped or repeated.
    expect(new Set(days.map((p) => p.ymd)).size).toBe(30);
  });

  it('lists the last days of the four months before this one', () => {
    expect(pastMonthEnds(NOW).map((p) => p.ymd)).toEqual(['2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30']);
  });

  it('uses the India day near midnight UTC', () => {
    // 29 Oct 20:00 UTC is already 30 Oct in India.
    expect(pastDays(new Date('2026-10-29T20:00:00Z'))[29]!.ymd).toBe('2026-10-29');
  });
});

describe('trailingKnown', () => {
  it('keeps the known run that reaches the latest period', () => {
    expect(trailingKnown([1, null, 3, 4])).toEqual([3, 4]);
    expect(trailingKnown([1, 2, 3, null])).toEqual([]);
    expect(trailingKnown([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });
});

describe('withSnapshots', () => {
  const periods = pastDays(NOW, 4);
  it('uses a stored snapshot for its day and the rebuild for the other days', () => {
    const stored = new Map([['2026-10-26', 9]]);
    expect(withSnapshots(periods, [1, 2, 3, 4], stored)).toEqual([1, 9, 3, 4]);
  });

  it('fills an unknown rebuilt day from a snapshot and keeps the others unknown', () => {
    expect(withSnapshots(periods, [null, null, 3, 4], new Map([['2026-10-26', 5]]))).toEqual([null, 5, 3, 4]);
    expect(withSnapshots(periods, undefined, new Map([['2026-10-28', 2]]))).toEqual([null, null, null, 2]);
    expect(withSnapshots(periods, [1, 2, 3, 4], undefined)).toEqual([1, 2, 3, 4]);
  });
});

describe('rollingDaySum', () => {
  it('sums each day and the days before it', () => {
    const periods = pastDays(NOW, 3); // 26, 27, 28 Oct
    const byDay = new Map([
      ['2026-10-20', 5],
      ['2026-10-21', 1],
      ['2026-10-27', 2],
    ]);
    // 26 Oct sums 20 to 26 Oct, 27 Oct sums 21 to 27 Oct, 28 Oct sums 22 to 28 Oct.
    expect(rollingDaySum(byDay, periods, 7)).toEqual([6, 3, 2]);
  });
});

describe('filedAsOf', () => {
  it('reads filed_on against the day', () => {
    expect(filedAsOf(filing({ status: 'filed', filedOn: '2026-10-27' }), [], day('2026-10-26'))).toBe(false);
    expect(filedAsOf(filing({ status: 'filed', filedOn: '2026-10-27' }), [], day('2026-10-27'))).toBe(true);
  });

  it('gives back the filed spell a reopen ended', () => {
    const reopen = { instanceId: 'f1', previousFiledOn: '2026-10-25', at: new Date('2026-10-28T06:00:00Z') };
    expect(filedAsOf(filing({ status: 'overdue' }), [reopen], day('2026-10-26'))).toBe(true);
    // Reopened during 28 Oct, so it was open at the end of that day.
    expect(filedAsOf(filing({ status: 'overdue' }), [reopen], day('2026-10-28'))).toBe(false);
  });

  it('cannot say when a row marked filed without a date was filed', () => {
    expect(filedAsOf(filing({ status: 'filed', filedOn: null }), [], day('2026-10-26'))).toBeNull();
  });
});

describe('superFilingsDueAsOf', () => {
  const sept = { ymd: '2026-09-30', end: istDayEnd('2026-09-30') };
  const live = new Set(['e1']);

  it('counts filings not filed and due from 90 days before to 30 days after the month end', () => {
    const rows = [
      filing({ id: 'a', dueDate: '2026-09-20' }), // overdue at the end of September
      filing({ id: 'b', dueDate: '2026-10-20' }), // due within 30 days
      filing({ id: 'c', dueDate: '2026-12-20' }), // too far ahead
      filing({ id: 'd', dueDate: '2026-09-25', status: 'filed', filedOn: '2026-09-24' }), // filed
      filing({ id: 'e', dueDate: '2026-10-05', status: 'filed', filedOn: '2026-10-03' }), // filed later: open then
      filing({ id: 'f', dueDate: '2026-10-05', createdAt: new Date('2026-10-02T00:00:00Z') }), // not created yet
      filing({ id: 'g', dueDate: '2026-10-05', engagementId: 'deleted' }), // engagement not in the list then
    ];
    expect(superFilingsDueAsOf(rows, [], sept, live)).toBe(3);
  });

  it('is unknown when a counted row was marked filed without a date', () => {
    expect(superFilingsDueAsOf([filing({ dueDate: '2026-10-05', status: 'filed' })], [], sept, live)).toBeNull();
  });
});

describe('clientDueSoonAsOf', () => {
  it('counts open filings due from the day to 15 days after it', () => {
    const rows = [
      filing({ id: 'a', dueDate: '2026-10-26' }),
      filing({ id: 'b', dueDate: '2026-11-10' }),
      filing({ id: 'c', dueDate: '2026-11-11' }), // 16 days after 26 Oct
      filing({ id: 'd', dueDate: '2026-10-25' }), // overdue, not due soon
      filing({ id: 'e', dueDate: '2026-10-30', status: 'filed', filedOn: '2026-10-20' }),
    ];
    expect(clientDueSoonAsOf(rows, [], day('2026-10-26'))).toBe(2);
  });
});

describe('engagementLiveAt', () => {
  const p = day('2026-10-26');
  it('counts a project created before the end and not deleted then', () => {
    expect(engagementLiveAt({ id: 'e1', createdAt: new Date('2026-10-01'), deletedAt: null }, [], p)).toBe(true);
    expect(engagementLiveAt({ id: 'e1', createdAt: new Date('2026-10-27'), deletedAt: null }, [], p)).toBe(false);
    // Deleted later still counted then.
    expect(engagementLiveAt({ id: 'e1', createdAt: new Date('2026-10-01'), deletedAt: new Date('2026-10-28') }, [], p)).toBe(true);
    expect(engagementLiveAt({ id: 'e1', createdAt: new Date('2026-10-01'), deletedAt: new Date('2026-10-20') }, [], p)).toBe(false);
  });

  it('leaves out a project that was deleted at the end and restored later', () => {
    const events = [
      { engagementId: 'e1', action: 'project.deleted' as const, at: new Date('2026-10-20') },
      { engagementId: 'e1', action: 'project.restored' as const, at: new Date('2026-10-28') },
    ];
    expect(engagementLiveAt({ id: 'e1', createdAt: new Date('2026-10-01'), deletedAt: null }, events, p)).toBe(false);
    expect(engagementLiveAt({ id: 'e1', createdAt: new Date('2026-10-01'), deletedAt: null }, events, day('2026-10-28'))).toBe(true);
  });
});

describe('messagesFailedAsOf', () => {
  it('counts rows written in the 24 hours before the day end that had failed by then', () => {
    const p = day('2026-10-26');
    const rows = [
      { createdAt: new Date('2026-10-26T10:00:00Z'), updatedAt: new Date('2026-10-26T10:01:00Z') },
      { createdAt: new Date('2026-10-26T10:00:00Z'), updatedAt: new Date('2026-10-27T10:00:00Z') }, // failed later
      { createdAt: new Date('2026-10-24T10:00:00Z'), updatedAt: new Date('2026-10-24T10:01:00Z') }, // too old
    ];
    expect(messagesFailedAsOf(rows, p)).toBe(1);
  });
});
