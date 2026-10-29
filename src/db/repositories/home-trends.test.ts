import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for the home card trends (`home-trends.ts`):
 *   super  — firm-wide admins only; everyone else is refused before any query.
 *   dev    — developer or super admin only.
 *   client — only the caller's own engagement, or one `assertEngagementAccess` approves; a
 *            foreign engagement reads as no trends and runs no filing query.
 *   lead / manager / admin — the matching role; no series and no query.
 */

type Call = { op: string; where?: SQL };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    orderBy: () => c,
    limit: () => c,
    groupBy: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const call: Call = { op: 'select' };
      calls.push(call);
      return chain(call);
    },
  },
}));

const assertEngagementAccess = vi.fn();
const getMyEngagement = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  getMyEngagement: (...a: unknown[]) => getMyEngagement(...a),
}));

const { getHomeTrends, HomeTrendsError } = await import('@/db/repositories/home-trends');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const NOW = new Date('2026-10-29T04:30:00Z');

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role, internId: role === 'intern' ? 'i1' : undefined };
}

const params = () => calls.flatMap((c) => (c.where ? dialect.sqlToQuery(c.where).params : []));

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  getMyEngagement.mockResolvedValue({ id: OWN });
  assertEngagementAccess.mockImplementation(async (_c: AuthContext, id: string) =>
    id === OWN ? { ok: true, dbId: OWN, row: { id: OWN } } : { ok: false, dbId: id, forbidden: true },
  );
});

describe('super home', () => {
  it.each(['manager', 'intern', 'client', 'developer'] as const)('refuses %s before any query', async (role) => {
    await expect(getHomeTrends(ctx(role), 'super', { now: NOW })).rejects.toBeInstanceOf(HomeTrendsError);
    expect(calls).toHaveLength(0);
  });

  it.each(['super_admin', 'admin'] as const)('%s gets month-end clients from the stored rows', async (role) => {
    results = [
      [
        { id: OWN, createdAt: new Date('2026-05-01'), deletedAt: null },
        { id: OTHER, createdAt: new Date('2026-08-15'), deletedAt: new Date('2026-10-10') },
      ],
      [],
      [],
      [],
    ];
    const trends = await getHomeTrends(ctx(role), 'super', { now: NOW });
    expect(trends.clients).toEqual([1, 1, 2, 2]);
    expect(trends.filingsDue).toEqual([0, 0, 0, 0]);
  });
});

describe('developer home', () => {
  it.each(['admin', 'manager', 'intern', 'client'] as const)('refuses %s before any query', async (role) => {
    await expect(getHomeTrends(ctx(role), 'dev', { now: NOW })).rejects.toBeInstanceOf(HomeTrendsError);
    expect(calls).toHaveLength(0);
  });

  it('counts failed messages and denied events per day end', async () => {
    results = [
      [{ createdAt: new Date('2026-10-28T08:00:00Z'), updatedAt: new Date('2026-10-28T08:00:05Z') }],
      [],
      [{ n: 0 }],
      [{ n: 1 }],
      [{ n: 1 }],
      [{ n: 3 }],
    ];
    const trends = await getHomeTrends(ctx('developer'), 'dev', { now: NOW });
    expect(trends.messagesFailed).toEqual([0, 0, 0, 1]);
    expect(trends.denied).toEqual([0, 1, 1, 3]);
  });
});

describe('client home', () => {
  it('reads only the own engagement', async () => {
    results = [[], []];
    const trends = await getHomeTrends(ctx('client'), 'client', { now: NOW });
    expect(trends.dueSoon).toEqual([0, 0, 0, 0]);
    expect(params()).toContain(OWN);
    expect(params()).not.toContain(OTHER);
  });

  it.each(['client', 'manager', 'intern'] as const)('%s asking for a foreign engagement gets nothing and no filing query', async (role) => {
    const trends = await getHomeTrends(ctx(role), 'client', { engagementId: OTHER, now: NOW });
    expect(trends).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it('a client with no engagement gets nothing', async () => {
    getMyEngagement.mockResolvedValue(null);
    expect(await getHomeTrends(ctx('client'), 'client', { now: NOW })).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it('a developer gets nothing', async () => {
    expect(await getHomeTrends(ctx('developer'), 'client', { engagementId: OWN, now: NOW })).toEqual({});
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });
});

describe('staff homes', () => {
  it.each([
    ['lead', 'intern'],
    ['manager', 'manager'],
    ['manager', 'super_admin'],
    ['admin', 'admin'],
    ['admin', 'super_admin'],
  ] as const)('%s home for %s returns no series and runs no query', async (home, role) => {
    expect(await getHomeTrends(ctx(role), home, { now: NOW })).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['lead', 'manager'],
    ['manager', 'intern'],
    ['manager', 'client'],
    ['admin', 'manager'],
  ] as const)('%s home refuses %s', async (home, role) => {
    await expect(getHomeTrends(ctx(role), home, { now: NOW })).rejects.toBeInstanceOf(HomeTrendsError);
  });
});
