import { describe, expect, it } from 'vitest';
import { byStage, closedAtForMove, openCount, winRate } from './pipeline';

const NOW = new Date('2026-10-29T06:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('winRate', () => {
  it('is won over won plus lost, inside the window only', () => {
    const rows = [
      { stage: 'won' as const, closedAt: daysAgo(5) },
      { stage: 'won' as const, closedAt: daysAgo(40) },
      { stage: 'lost' as const, closedAt: daysAgo(10) },
      { stage: 'lost' as const, closedAt: daysAgo(200) },
      { stage: 'proposal' as const, closedAt: null },
    ];
    expect(winRate(rows, '30', NOW)).toEqual({ won: 1, lost: 1, pct: 50 });
    expect(winRate(rows, '90', NOW)).toEqual({ won: 2, lost: 1, pct: 67 });
    expect(winRate(rows, 'all', NOW)).toEqual({ won: 2, lost: 2, pct: 50 });
  });

  it('is null when nothing closed, and ignores closed rows without a date', () => {
    expect(winRate([], 'all', NOW).pct).toBeNull();
    expect(winRate([{ stage: 'won', closedAt: null }], 'all', NOW)).toEqual({ won: 0, lost: 0, pct: null });
  });
});

describe('closedAtForMove', () => {
  const earlier = new Date('2026-09-01T00:00:00Z');
  it('stamps now when a prospect closes', () => {
    expect(closedAtForMove('proposal', 'won', null, NOW)).toBe(NOW);
  });
  it('keeps the first close date between won and lost', () => {
    expect(closedAtForMove('won', 'lost', earlier, NOW)).toBe(earlier);
  });
  it('clears the date when a prospect reopens', () => {
    expect(closedAtForMove('lost', 'contacted', earlier, NOW)).toBeNull();
  });
});

describe('byStage and openCount', () => {
  it('groups in board order with the newest change first', () => {
    const rows = [
      { id: 'a', stage: 'lead' as const, updatedAt: '2026-10-01T00:00:00Z' },
      { id: 'b', stage: 'lead' as const, updatedAt: '2026-10-05T00:00:00Z' },
      { id: 'c', stage: 'won' as const, updatedAt: '2026-10-02T00:00:00Z' },
    ];
    const grouped = byStage(rows);
    expect(grouped.lead.map((r) => r.id)).toEqual(['b', 'a']);
    expect(grouped.won.map((r) => r.id)).toEqual(['c']);
    expect(grouped.lost).toEqual([]);
    expect(openCount(rows)).toBe(2);
  });
});
