import { describe, expect, it } from 'vitest';
import {
  delayDays,
  filingMonths,
  loadOf,
  onTimeStats,
  twelveMonthsBack,
  type FilingRecord,
} from '@/lib/metrics/filing-metrics';

const NOW = new Date('2026-10-29T10:00:00.000Z');

function f(dueDate: string, filedOn: string | null, status = filedOn ? 'filed' : 'upcoming'): FilingRecord {
  return { engagementId: 'e1', dueDate, filedOn, status };
}

describe('onTimeStats', () => {
  it('counts filed_on <= due_date over filed ones in the window', () => {
    const since = twelveMonthsBack(NOW);
    expect(since).toBe('2025-10-29');
    const stats = onTimeStats(
      [
        f('2026-09-30', '2026-09-28'),
        f('2026-09-30', '2026-09-30'),
        f('2026-08-31', '2026-09-04'),
        f('2025-06-30', '2025-06-01'), // before the window
        f('2026-10-31', null), // not filed
        f('2026-07-31', null, 'filed'), // filed without a date: no evidence, left out
      ],
      since,
    );
    expect(stats).toEqual({ filed: 3, onTime: 2, pct: 67 });
  });

  it('has no percentage without filings', () => {
    expect(onTimeStats([], '2025-01-01').pct).toBeNull();
  });
});

describe('filingMonths', () => {
  it('buckets by due month with completion and delay', () => {
    const months = filingMonths(
      [
        f('2026-09-10', '2026-09-09'),
        f('2026-09-20', '2026-09-24'),
        f('2026-09-25', null, 'overdue'),
        f('2026-10-31', null),
      ],
      NOW,
      2,
    );
    expect(months.map((m) => m.key)).toEqual(['2026-09', '2026-10']);
    const sep = months[0]!;
    expect(sep).toMatchObject({ due: 3, onTime: 1, late: 1, overdue: 1, completionPct: 33, avgDelayDays: 2 });
    expect(months[1]).toMatchObject({ due: 1, completionPct: null, avgDelayDays: null });
  });

  it('measures delay as days past due, never negative', () => {
    expect(delayDays({ dueDate: '2026-09-10', filedOn: '2026-09-01' })).toBe(0);
    expect(delayDays({ dueDate: '2026-09-10', filedOn: '2026-09-13' })).toBe(3);
    expect(delayDays({ dueDate: '2026-09-10', filedOn: null })).toBeNull();
  });
});

describe('loadOf', () => {
  it('compares open items with capacity', () => {
    expect(loadOf(5, 10)).toEqual({ open: 5, capacity: 10, pct: 50, tone: 'ok' });
    expect(loadOf(9, 10).tone).toBe('warn');
    expect(loadOf(12, 10).tone).toBe('bad');
    expect(loadOf(4, null)).toEqual({ open: 4, capacity: null, pct: null, tone: 'none' });
  });
});
