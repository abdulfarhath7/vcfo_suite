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
 *   lead    — project leads only; events and filings only for their scoped engagements,
 *             tasks only where they are the assignee.
 *   manager — managers and firm admins; the manager's scoped engagements only.
 *   admin   — firm-wide admins only; every engagement.
 */

type Call = { op: string; where?: SQL };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
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
const listScopedEngagementIds = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  getMyEngagement: (...a: unknown[]) => getMyEngagement(...a),
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
  checklistStateFromRow: (row: { checklistState?: unknown }) => row.checklistState ?? {},
  checklistStateForViewer: (_c: unknown, state: unknown) => state,
}));

const getHomeTileStampDays = vi.fn();
vi.mock('@/db/repositories/home-tile-stamps', () => ({
  getHomeTileStampDays: (...a: unknown[]) => getHomeTileStampDays(...a),
}));

const { getHomeTrends, HomeTrendsError } = await import('@/db/repositories/home-trends');

/** `n` zeros, then `tail`: a 30-day series whose last days are `tail`. */
const zerosThen = (tail: number[], n = 30) => [...Array(n - tail.length).fill(0), ...tail];

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
  listScopedEngagementIds.mockResolvedValue([OWN]);
  getHomeTileStampDays.mockResolvedValue({});
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

  it('counts failed messages and denied events per day end over 30 days, one query each', async () => {
    results = [
      [{ createdAt: new Date('2026-10-28T08:00:00Z'), updatedAt: new Date('2026-10-28T08:00:05Z') }],
      [],
      // Denied events per India day; each day end sums its own 7 days.
      [
        { day: '2026-10-26', n: 1 },
        { day: '2026-10-28', n: 2 },
      ],
    ];
    const trends = await getHomeTrends(ctx('developer'), 'dev', { now: NOW });
    expect(trends.messagesFailed).toEqual(zerosThen([1]));
    expect(trends.denied).toEqual(zerosThen([1, 1, 3]));
    expect(calls).toHaveLength(3);
  });
});

describe('client home', () => {
  it('reads only the own engagement', async () => {
    results = [[], []];
    const trends = await getHomeTrends(ctx('client'), 'client', { now: NOW });
    expect(trends.dueSoon).toEqual(zerosThen([]));
    expect(params()).toContain(OWN);
    expect(params()).not.toContain(OTHER);
  });

  it('builds Documents in from the requests of the own engagement (closed_at or the first file)', async () => {
    results = [
      [],
      [],
      [
        { id: 'a', status: 'fulfilled', closedAt: new Date('2026-10-26T05:00:00Z'), createdAt: new Date('2026-10-20T05:00:00Z') },
        { id: 'b', status: 'fulfilled', closedAt: null, createdAt: new Date('2026-10-20T05:00:00Z') },
        { id: 'c', status: 'pending', closedAt: null, createdAt: new Date('2026-10-20T05:00:00Z') },
      ],
      [{ requestId: 'b', at: new Date('2026-10-27T05:00:00Z') }],
      [],
    ];
    const trends = await getHomeTrends(ctx('client'), 'client', { now: NOW });
    expect(trends.docsIn).toEqual(zerosThen([1, 2, 2]));
    expect(calls).toHaveLength(5);
    expect(params()).toContain(OWN);
    expect(params()).not.toContain(OTHER);
  });

  it('draws every tile from day one, even with no stored history', async () => {
    results = [[], [], [], [], []];
    const trends = await getHomeTrends(ctx('client'), 'client', { now: NOW });
    for (const key of ['waiting', 'overdue', 'withSbc', 'docsIn', 'stepsDone', 'regs', 'dueSoon', 'filingsOverdue']) {
      expect(trends[key]).toHaveLength(30);
    }
  });

  it('builds Steps done and With SBC by undoing the later step events', async () => {
    const { buildIncorporationModel } = await import('@/lib/client-portal/step-model');
    const step = buildIncorporationModel({}).steps[0]!.id;
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { id: OWN, checklistState: { [step]: { status: 'completed' } } } });
    results = [[], [], [], [], [{ stepId: step, fromStatus: 'in-progress', toStatus: 'completed', reviewStatus: null, at: new Date('2026-10-27T05:00:00Z') }]];
    const trends = await getHomeTrends(ctx('client'), 'client', { now: NOW });
    expect(trends.stepsDone).toEqual(zerosThen([1, 1]));
  });

  it('starts every line on the creation day of an engagement younger than 30 days', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { id: OWN, createdAt: new Date('2026-10-19T05:00:00Z') } });
    results = [[], [], [], [], []];
    const trends = await getHomeTrends(ctx('client'), 'client', { now: NOW });
    // 19 to 28 Oct: ten past days, then the screen adds today.
    for (const key of ['waiting', 'overdue', 'withSbc', 'docsIn', 'stepsDone', 'regs']) expect(trends[key]).toHaveLength(10);
    expect(calls).toHaveLength(5);
  });

  it('ends a line where a closed request has no close time', async () => {
    results = [[], [], [{ id: 'x', status: 'cancelled', closedAt: null, createdAt: new Date('2026-10-20T05:00:00Z') }], [], []];
    const trends = await getHomeTrends(ctx('client'), 'client', { now: NOW });
    expect(trends.waiting).toBeUndefined();
    expect(trends.docsIn).toBeUndefined();
    expect(trends.stepsDone).toHaveLength(30);
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
  // Day ends (IST) of 25, 26, 27 and 28 Oct 2026 for NOW = 29 Oct.
  const day = (d: number, hh = '06') => new Date(`2026-10-${d}T${hh}:00:00Z`);

  it('manager approvals read only the scoped engagements and rebuild from review events', async () => {
    results = [
      [{ at: day(20) }],
      [
        {
          id: OWN,
          createdAt: day(1),
          checklistState: { 'post-1': { status: 'in-progress', reviewStatus: 'accepted' } },
        },
      ],
      [
        { engagementId: OWN, stepId: 'post-1', fromStatus: 'in-progress', toStatus: 'in-progress', reviewStatus: 'reviewing', at: day(24) },
        { engagementId: OWN, stepId: 'post-1', fromStatus: 'in-progress', toStatus: 'in-progress', reviewStatus: 'accepted', at: day(27) },
      ],
    ];
    const trends = await getHomeTrends(ctx('manager'), 'manager', { now: NOW });
    expect(trends.approvals!.slice(-4)).toEqual([1, 1, 0, 0]);
    expect(params()).toContain(OWN);
    expect(params()).not.toContain(OTHER);
  });

  it('a stored stamp wins over the rebuilt value of its day, and stamp-only tiles get their days', async () => {
    getHomeTileStampDays.mockResolvedValue({
      approvals: new Map([['2026-10-27', 5]]),
      overdue: new Map([
        ['2026-10-27', 2],
        ['2026-10-28', 3],
      ]),
    });
    results = [
      [{ at: day(20) }],
      [{ id: OWN, createdAt: day(1), checklistState: { 'post-1': { status: 'in-progress', reviewStatus: 'accepted' } } }],
      [
        { engagementId: OWN, stepId: 'post-1', fromStatus: 'in-progress', toStatus: 'in-progress', reviewStatus: 'reviewing', at: day(24) },
        { engagementId: OWN, stepId: 'post-1', fromStatus: 'in-progress', toStatus: 'in-progress', reviewStatus: 'accepted', at: day(27) },
      ],
    ];
    const trends = await getHomeTrends(ctx('manager'), 'manager', { now: NOW });
    expect(trends.approvals!.slice(-4)).toEqual([1, 1, 5, 0]);
    expect(trends.overdue).toEqual([2, 3]);
    expect(getHomeTileStampDays).toHaveBeenCalledWith(expect.objectContaining({ role: 'manager' }), 'manager', NOW);
  });

  it('a manager with no engagements gets nothing and runs no query', async () => {
    listScopedEngagementIds.mockResolvedValue([]);
    expect(await getHomeTrends(ctx('manager'), 'manager', { now: NOW })).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it('no review history yet draws no approvals line', async () => {
    results = [[{ at: null }], [{ id: OWN, createdAt: day(1), checklistState: {} }], []];
    expect(await getHomeTrends(ctx('admin'), 'admin', { now: NOW })).toEqual({});
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
  });

  it('lead done today counts steps, tasks and filings, scoped to the lead', async () => {
    results = [
      [{ at: day(1) }],
      [{ engagementId: OWN, stepId: 'pre-1', fromStatus: 'in-progress', toStatus: 'completed', reviewStatus: null, at: day(27) }],
      [{ status: 'done', completedAt: day(28), updatedAt: day(28) }],
      [{ id: 'f1', engagementId: OWN, dueDate: '2026-10-26', status: 'filed', filedOn: '2026-10-26', createdAt: day(1) }],
      [],
    ];
    const trends = await getHomeTrends(ctx('intern'), 'lead', { now: NOW });
    expect(trends.doneToday!.slice(-4)).toEqual([0, 1, 1, 1]);
    expect(listScopedEngagementIds).toHaveBeenCalledWith(expect.objectContaining({ role: 'intern' }));
    expect(params()).toContain(OWN);
    expect(params()).toContain('user-intern');
    expect(params()).not.toContain(OTHER);
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
