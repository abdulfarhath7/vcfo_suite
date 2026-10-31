import { describe, expect, it } from 'vitest';
import { NO_HISTORY, tileTrend } from '@/hooks/use-home-trends';

describe('tileTrend', () => {
  it('draws nothing while the trends load', () => {
    expect(tileTrend(undefined, 'waiting', 3)).toEqual({});
  });

  it('adds the live count to the past values', () => {
    expect(tileTrend({ waiting: [1, 2] }, 'waiting', 3)).toEqual({ trend: [1, 2, 3] });
  });

  it('asks for a flat line and "No history yet" when the tile has no past values', () => {
    expect(tileTrend({}, 'waiting', 3)).toEqual({ trendEmpty: NO_HISTORY });
    expect(tileTrend({ docsIn: [1] }, 'docsIn', '1/2')).toEqual({ trendEmpty: NO_HISTORY });
  });

  it('sums a second series point by point and trims to the shorter one', () => {
    expect(tileTrend({ overdue: [1, 1, 2, 2], filingsOverdue: [0, 1] }, 'overdue', 5, 'filingsOverdue')).toEqual({ trend: [2, 3, 5] });
  });
});

describe('tileTrend over the 30-day window', () => {
  it('draws 30 past days plus the live count', () => {
    const past = Array.from({ length: 30 }, (_, i) => i % 3);
    const out = tileTrend({ waiting: past }, 'waiting', 4);
    expect(out.trend).toHaveLength(31);
    expect(out.trend!.at(-1)).toBe(4);
  });

  it('draws a line from two real points: one past day and the live count', () => {
    expect(tileTrend({ stepsDone: [2] }, 'stepsDone', 3)).toEqual({ trend: [2, 3] });
  });

  it('trims a 30-day series to a young engagement that has 10 days', () => {
    const overdue = Array(10).fill(1);
    const filings = Array(30).fill(2);
    expect(tileTrend({ overdue, filingsOverdue: filings }, 'overdue', 0, 'filingsOverdue').trend).toHaveLength(11);
  });
});
