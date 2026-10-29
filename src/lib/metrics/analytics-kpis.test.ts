import { describe, expect, it } from 'vitest';
import { analyticsKpis, kpiChange, previousMonthEnd } from '@/lib/metrics/analytics-kpis';

describe('analytics kpis', () => {
  it('counts steps the way the Analytics tiles do', () => {
    const k = analyticsKpis(
      [
        { a: { status: 'completed' }, b: { status: 'awaiting-client' }, c: { status: 'not-applicable' } },
        { a: { status: 'overdue' } },
      ],
      ['a', 'b', 'c'],
    );
    expect(k).toEqual({ projects: 2, stepsDone: 1, stepsTotal: 5, awaitingClient: 1, overdue: 1 });
  });

  it('gives no change without last month', () => {
    expect(kpiChange(5, undefined)).toBeNull();
    expect(kpiChange(null, 3)).toBeNull();
    expect(kpiChange(5, 3)).toBe(2);
    expect(kpiChange(81.5, 84)).toBe(-2.5);
  });

  it('takes the last day of the previous month in India time', () => {
    expect(previousMonthEnd(new Date('2026-11-01T00:10:00+05:30'))).toBe('2026-10-31');
    expect(previousMonthEnd(new Date('2026-03-01T00:10:00+05:30'))).toBe('2026-02-28');
  });
});
