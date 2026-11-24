import { describe, expect, it } from 'vitest';
import { backoffDelay } from '../src/backoff';
import { fromTallyDate, splitByMonth, toTallyDate } from '../src/months';

describe('splitByMonth', () => {
  it('returns one piece inside a single month', () => {
    expect(splitByMonth('2026-04-03', '2026-04-20')).toEqual([{ from: '2026-04-03', to: '2026-04-20' }]);
  });

  it('splits across months, leap February and the year end', () => {
    expect(splitByMonth('2027-12-15', '2028-03-02')).toEqual([
      { from: '2027-12-15', to: '2027-12-31' },
      { from: '2028-01-01', to: '2028-01-31' },
      { from: '2028-02-01', to: '2028-02-29' },
      { from: '2028-03-01', to: '2028-03-02' },
    ]);
  });

  it('covers a full financial year in twelve pieces', () => {
    const parts = splitByMonth('2026-04-01', '2027-03-31');
    expect(parts).toHaveLength(12);
    expect(parts[11]).toEqual({ from: '2027-03-01', to: '2027-03-31' });
  });

  it('rejects bad input', () => {
    expect(() => splitByMonth('2026-05-01', '2026-04-01')).toThrow();
    expect(() => splitByMonth('2026-02-30', '2026-03-01')).toThrow();
  });

  it('converts dates to and from the Tally format', () => {
    expect(toTallyDate('2026-04-01')).toBe('20260401');
    expect(fromTallyDate('20260401')).toBe('2026-04-01');
    expect(fromTallyDate('1-Apr-26')).toBeNull();
  });
});

describe('backoffDelay', () => {
  it('waits 5 s, 15 s, then 60 s at most', () => {
    expect([0, 1, 2, 3, 4, 50].map(backoffDelay)).toEqual([0, 5000, 15000, 60000, 60000, 60000]);
  });
});
