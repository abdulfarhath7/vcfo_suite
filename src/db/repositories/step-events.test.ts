import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * engagement_step_events (README rule): staff read, scoped like engagements.
 *   admin / super_admin — every engagement
 *   manager / intern    — listScopedEngagementIds(ctx) only
 *   client / developer  — nothing, and no query is made
 * Writes happen only inside updateChecklistState's transaction; the actor is the session user.
 */

type Call = { op: string; where?: SQL; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    orderBy: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    values: (v: unknown) => {
      call.values = v;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}
function op(name: string) {
  return () => {
    const call: Call = { op: name };
    calls.push(call);
    return chain(call);
  };
}

vi.mock('@/db/client', () => ({ db: { select: op('select'), insert: op('insert') } }));

const listScopedEngagementIds = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
}));

const repo = await import('@/db/repositories/step-events');
const { db } = await import('@/db/client');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const NOW = new Date('2026-10-29T10:00:00.000Z');

function ctx(role: AuthContext['role']): AuthContext {
  return {
    userId: `user-${role}`,
    email: `${role}@vcfo.local`,
    name: role,
    role,
    internId: role === 'intern' ? 'i1' : undefined,
    clientId: role === 'client' ? 'c1' : undefined,
  };
}

function selectWhere() {
  const w = calls.find((c) => c.op === 'select')?.where;
  return w ? dialect.sqlToQuery(w) : null;
}

function eventRow(engagementId: string, stepId: string, toStatus: string, at: string) {
  return { engagementId, stepId, fromStatus: null, toStatus, at: new Date(at) };
}

beforeEach(() => {
  calls.length = 0;
  results = [];
  listScopedEngagementIds.mockReset();
});

describe('listStepEvents scope', () => {
  it.each(['admin', 'super_admin'] as const)('%s reads firm-wide without an id filter', async (role) => {
    results = [[eventRow(OTHER, 'pre-1', 'in-progress', '2026-10-01T00:00:00Z')]];
    const events = await repo.listStepEvents(ctx(role));
    expect(events).toHaveLength(1);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    expect(selectWhere()).toBeNull();
  });

  it.each(['manager', 'intern'] as const)('%s reads only scoped engagements', async (role) => {
    listScopedEngagementIds.mockResolvedValue([OWN]);
    await repo.listStepEvents(ctx(role));
    const q = selectWhere()!;
    expect(q.params).toContain(OWN);
    expect(q.params).not.toContain(OTHER);
  });

  it.each(['manager', 'intern'] as const)('%s asking for a foreign engagement gets nothing and no query', async (role) => {
    listScopedEngagementIds.mockResolvedValue([OWN]);
    const events = await repo.listStepEvents(ctx(role), { engagementIds: [OTHER] });
    expect(events).toEqual([]);
    expect(calls.filter((c) => c.op === 'select')).toHaveLength(0);
  });

  it.each(['client', 'developer'] as const)('%s gets nothing and no query', async (role) => {
    const events = await repo.listStepEvents(ctx(role));
    expect(events).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
  });

  it('a manager with no engagements gets nothing and no query', async () => {
    listScopedEngagementIds.mockResolvedValue([]);
    expect(await repo.listStepEvents(ctx('manager'))).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('reads', () => {
  it('getStepTimings: opened, finished and days in step per step', async () => {
    results = [
      [
        eventRow(OWN, 'pre-1', 'in-progress', '2026-10-01T09:00:00Z'),
        eventRow(OWN, 'pre-1', 'completed', '2026-10-05T09:00:00Z'),
        eventRow(OWN, 'pre-2', 'in-progress', '2026-10-19T09:00:00Z'),
      ],
    ];
    const timings = await repo.getStepTimings(ctx('admin'), OWN, NOW);
    expect(timings['pre-1']).toMatchObject({ openedAt: '2026-10-01T09:00:00.000Z', finishedAt: '2026-10-05T09:00:00.000Z', daysInStep: 4 });
    expect(timings['pre-2']).toMatchObject({ finishedAt: null, daysInStep: 10 });
  });

  it('getStepTiming: null for a step with no events', async () => {
    results = [[eventRow(OWN, 'pre-1', 'in-progress', '2026-10-01T09:00:00Z')]];
    expect(await repo.getStepTiming(ctx('admin'), OWN, 'pre-9', NOW)).toBeNull();
  });

  it('getStageAverages: one row per phase, and nothing for a client', async () => {
    results = [[eventRow(OWN, 'pre-1', 'in-progress', '2026-10-01T09:00:00Z')]];
    const stages = await repo.getStageAverages(ctx('admin'), {}, NOW);
    expect(stages.length).toBeGreaterThanOrEqual(4);
    expect(stages.every((s) => 'avgDays' in s && 'slowest' in s)).toBe(true);
    expect(await repo.getStageAverages(ctx('client'), {}, NOW)).toEqual([]);
  });
});

describe('writeStepEvents', () => {
  it('writes one row per change with the session user as actor', async () => {
    await repo.writeStepEvents(ctx('manager'), db, OWN, [
      { stepId: 'pre-1', from: 'in-progress', to: 'completed' },
      { stepId: 'pre-2', from: null, to: 'in-progress' },
    ], NOW);
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.values).toEqual([
      { engagementId: OWN, stepId: 'pre-1', fromStatus: 'in-progress', toStatus: 'completed', reviewStatus: null, holder: null, actorId: 'user-manager', at: NOW },
      { engagementId: OWN, stepId: 'pre-2', fromStatus: null, toStatus: 'in-progress', reviewStatus: null, holder: null, actorId: 'user-manager', at: NOW },
    ]);
  });

  it('keeps who holds the step after the change', async () => {
    await repo.writeStepEvents(ctx('manager'), db, OWN, [
      { stepId: 'pre-2', from: 'not-started', to: 'in-progress', holder: 'lead' },
    ], NOW);
    const insert = calls.find((c) => c.op === 'insert')!;
    expect((insert.values as Array<{ holder: string }>)[0]!.holder).toBe('lead');
  });

  it('keeps the review state after the change', async () => {
    await repo.writeStepEvents(ctx('manager'), db, OWN, [
      { stepId: 'post-1', from: 'in-progress', to: 'in-progress', reviewStatus: 'reviewing' },
    ], NOW);
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.values).toEqual([
      { engagementId: OWN, stepId: 'post-1', fromStatus: 'in-progress', toStatus: 'in-progress', reviewStatus: 'reviewing', holder: null, actorId: 'user-manager', at: NOW },
    ]);
  });

  it('writes nothing without changes', async () => {
    await repo.writeStepEvents(ctx('manager'), db, OWN, []);
    expect(calls).toHaveLength(0);
  });
});
