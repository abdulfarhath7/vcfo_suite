import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';
import { istWeekBounds, sumBlockHours } from '@/lib/metrics/lead-hours';

/**
 * Cross-tenant scoping for the Analytics workload hours (`lead-hours.ts`): firm admins see every
 * lead, a manager only the leads who report to them, and every other role reads nothing.
 */

const wheres: SQL[] = [];
let results: unknown[][] = [];

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const c: Record<string, unknown> = {
        from: () => c,
        where: (w: SQL) => {
          wheres.push(w);
          return c;
        },
        then: (res: (v: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res),
      };
      return c;
    },
  },
}));

const { getLeadHoursThisWeek } = await import('@/db/repositories/lead-hours');
const dialect = new PgDialect();
const ctx = (role: AuthContext['role'], userId = 'mgr-1'): AuthContext => ({ userId, email: 'x@y', name: 'X', role });
const NOW = new Date('2026-10-30T06:00:00Z'); // Friday in India

beforeEach(() => {
  wheres.length = 0;
  results = [];
});

describe('getLeadHoursThisWeek', () => {
  it('a manager reads only the leads who report to them', async () => {
    results = [[{ id: 'lead-1', name: 'Asha', email: 'a@x', internId: 'I1' }], [
      { userId: 'lead-1', startsAt: new Date('2026-10-27T04:00:00Z'), endsAt: new Date('2026-10-27T06:30:00Z') },
    ]];
    const out = await getLeadHoursThisWeek(ctx('manager', 'mgr-9'), NOW);
    expect(out.weekStart).toBe('2026-10-26');
    expect(out.leads).toEqual([{ profileId: 'lead-1', internId: 'I1', name: 'Asha', hours: 2.5 }]);
    const people = dialect.sqlToQuery(wheres[0]!);
    expect(people.sql).toContain('reports_to_manager_id');
    expect(people.params).toContain('mgr-9');
    const blocks = dialect.sqlToQuery(wheres[1]!);
    expect(blocks.params).toContain('lead-1');
  });

  it('a firm admin reads every active lead', async () => {
    results = [[], []];
    await getLeadHoursThisWeek(ctx('admin'), NOW);
    expect(dialect.sqlToQuery(wheres[0]!).sql).not.toContain('reports_to_manager_id');
  });

  it('leads, clients and developers read nothing', async () => {
    for (const role of ['intern', 'client', 'developer'] as const) {
      const out = await getLeadHoursThisWeek(ctx(role), NOW);
      expect(out.leads).toEqual([]);
    }
    expect(wheres).toEqual([]);
  });
});

describe('pure rules', () => {
  it('the India week starts on Monday 00:00 IST', () => {
    const { start, end } = istWeekBounds(new Date('2026-10-25T20:00:00Z')); // Monday 01:30 IST
    expect(start.toISOString()).toBe('2026-10-25T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T18:30:00.000Z');
  });

  it('cuts a block at the week end', () => {
    const cap = new Date('2026-11-01T18:30:00Z');
    const out = sumBlockHours([{ userId: 'a', startsAt: new Date('2026-11-01T17:30:00Z'), endsAt: new Date('2026-11-01T20:30:00Z') }], cap);
    expect(out.get('a')).toBe(1);
  });
});
