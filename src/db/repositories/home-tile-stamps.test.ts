import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';
import { stampSeries, cleanStampValues } from '@/lib/metrics/home-tile-stamps';

/**
 * Cross-tenant scoping for the home tile stamps (`home-tile-stamps.ts`): each home has one role
 * rule, a caller writes and reads only rows under their own profile id, and unknown tile keys
 * are dropped before the write.
 */

let inserted: Array<Record<string, unknown>> = [];
let lastWhere: SQL | undefined;
let rows: unknown[] = [];

vi.mock('@/db/client', () => ({
  db: {
    insert: () => ({
      values: (v: Array<Record<string, unknown>>) => {
        inserted = v;
        return { onConflictDoUpdate: () => Promise.resolve() };
      },
    }),
    select: () => {
      const c: Record<string, unknown> = {
        from: () => c,
        where: (w: SQL) => {
          lastWhere = w;
          return c;
        },
        then: (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res),
      };
      return c;
    },
  },
}));

const { stampHomeTiles, getHomeTileTrends, HomeTileStampError } = await import('@/db/repositories/home-tile-stamps');

const dialect = new PgDialect();
const ctx = (role: AuthContext['role'], userId = 'user-a'): AuthContext => ({ userId, email: 'a@x', name: 'A', role });
const NOW = new Date('2026-10-30T06:00:00Z');

beforeEach(() => {
  inserted = [];
  lastWhere = undefined;
  rows = [];
});

describe('stampHomeTiles', () => {
  it('writes only known keys under the caller id for today (India date)', async () => {
    const n = await stampHomeTiles(ctx('intern', 'lead-1'), 'lead', { overdue: 3, needsAction: 5, other: 9, dueWeek: -1 }, NOW);
    expect(n).toBe(2);
    expect(inserted.map((r) => [r.key, r.scope, r.period, r.value])).toEqual([
      ['tile:lead:overdue', 'lead-1', '2026-10-30', '3'],
      ['tile:lead:needsAction', 'lead-1', '2026-10-30', '5'],
    ]);
  });

  it('refuses a home that is not the caller role', async () => {
    await expect(stampHomeTiles(ctx('manager'), 'lead', { overdue: 1 }, NOW)).rejects.toBeInstanceOf(HomeTileStampError);
    await expect(stampHomeTiles(ctx('manager'), 'admin', { stuck: 1 }, NOW)).rejects.toBeInstanceOf(HomeTileStampError);
    await expect(stampHomeTiles(ctx('client'), 'manager', { overdue: 1 }, NOW)).rejects.toBeInstanceOf(HomeTileStampError);
    await expect(stampHomeTiles(ctx('intern'), 'manager', { overdue: 1 }, NOW)).rejects.toBeInstanceOf(HomeTileStampError);
    expect(inserted).toEqual([]);
  });

  it('lets admins use the manager and admin homes', async () => {
    await stampHomeTiles(ctx('admin', 'adm'), 'admin', { stuck: 2 }, NOW);
    expect(inserted[0]?.scope).toBe('adm');
    await stampHomeTiles(ctx('super_admin', 'sup'), 'manager', { overdue: 2 }, NOW);
    expect(inserted[0]?.scope).toBe('sup');
  });
});

describe('getHomeTileTrends', () => {
  it('reads only the caller scope and the four days before today', async () => {
    rows = [
      { period: '2026-10-28', key: 'tile:lead:overdue', value: '2' },
      { period: '2026-10-29', key: 'tile:lead:overdue', value: '4' },
    ];
    const out = await getHomeTileTrends(ctx('intern', 'lead-7'), 'lead', NOW);
    expect(out).toEqual({ overdue: [2, 4] });
    const q = dialect.sqlToQuery(lastWhere!);
    expect(q.params).toContain('lead-7');
    expect(q.params).toContain('2026-10-26');
    expect(q.params).toContain('2026-10-29');
    expect(q.params).not.toContain('2026-10-30');
  });

  it('refuses another role before any read', async () => {
    await expect(getHomeTileTrends(ctx('client'), 'lead', NOW)).rejects.toBeInstanceOf(HomeTileStampError);
    expect(lastWhere).toBeUndefined();
  });
});

describe('pure rules', () => {
  it('drops a series across a missing day', () => {
    const days = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'];
    const out = stampSeries('admin', days, [
      { period: '2026-10-26', key: 'tile:admin:stuck', value: 9 },
      { period: '2026-10-28', key: 'tile:admin:stuck', value: 3 },
      { period: '2026-10-29', key: 'tile:admin:stuck', value: 4 },
    ]);
    expect(out).toEqual({ stuck: [3, 4] });
  });

  it('keeps whole numbers only', () => {
    expect(cleanStampValues('manager', { overdue: 1.5, dueWeek: 2, activeProjects: 'x' })).toEqual({ dueWeek: 2 });
  });
});
