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
