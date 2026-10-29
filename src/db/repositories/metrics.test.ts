import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Metrics repository scope (README rule):
 *   practice / analytics — staff, over listEngagements(ctx); clients and developers get null
 *   people               — admin / super admin all managers and leads; manager self + own leads;
 *                          everyone else nothing
 *   capacity write       — admin / super admin only, on a manager or project lead
 * Every direct read (memberships, filings, profiles) is limited to the engagement ids the
 * engagement scope returned, so another firm's engagement id never reaches a WHERE clause.
 */

type Call = { op: string; where?: SQL; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    orderBy: () => c,
    limit: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    set: (v: unknown) => {
      call.set = v;
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

vi.mock('@/db/client', () => ({ db: { select: op('select'), update: op('update'), insert: op('insert') } }));

const listEngagements = vi.fn();
const listChecklistIndex = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listEngagements: (...a: unknown[]) => listEngagements(...a),
  listChecklistIndex: (...a: unknown[]) => listChecklistIndex(...a),
}));
const getTimingIndex = vi.fn(async () => new Map());
vi.mock('@/db/repositories/step-events', () => ({
  getTimingIndex: (...a: unknown[]) => getTimingIndex(...(a as [])),
  incorporationStages: () => [],
}));
const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));

const repo = await import('@/db/repositories/metrics');

const dialect = new PgDialect();
const OWN = 'aaaaaaaa-1111-4111-8111-111111111101';
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

function engagementRow(id: string) {
  return {
    id,
    slug: 'acme',
    companyName: 'Acme',
    clientName: null,
    stage: 'Pre-Incorporation',
    health: 'on-track',
    internId: 'i1',
    managerId: 'user-manager',
    adminId: null,
    incorporationDate: null,
    expectedCoiOn: '2026-11-09',
    schedule: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-10-20T00:00:00Z'),
  };
}

function allParams(): unknown[] {
  return calls.flatMap((c) => (c.where ? dialect.sqlToQuery(c.where).params : []));
}

beforeEach(() => {
  calls.length = 0;
  results = [];
  listEngagements.mockReset();
  listChecklistIndex.mockReset();
  recordAuditEvent.mockReset();
  getTimingIndex.mockClear();
});

describe('getPracticeMetrics and getAnalyticsMetrics', () => {
  it.each(['client', 'developer'] as const)('%s gets null and no query', async (role) => {
    expect(await repo.getPracticeMetrics(ctx(role), NOW)).toBeNull();
    expect(await repo.getAnalyticsMetrics(ctx(role), {}, NOW)).toBeNull();
    expect(calls).toHaveLength(0);
    expect(listEngagements).not.toHaveBeenCalled();
  });

  it.each(['manager', 'intern'] as const)('%s reads only the engagements its scope returned', async (role) => {
    listEngagements.mockResolvedValue([engagementRow(OWN)]);
    listChecklistIndex.mockResolvedValue({ [OWN]: {} });
    const practice = await repo.getPracticeMetrics(ctx(role), NOW);
    expect(practice?.incorporation.clients).toBe(1);
    expect(practice?.incorporation.expected.map((e) => e.engagementId)).toEqual([OWN]);
    const params = allParams();
    expect(params).toContain(OWN);
    expect(params).not.toContain(OTHER);
    expect(getTimingIndex).toHaveBeenCalledWith(expect.objectContaining({ role }), { engagementIds: [OWN] }, NOW);
  });

  it('a scope with no engagements makes no direct read', async () => {
    listEngagements.mockResolvedValue([]);
    listChecklistIndex.mockResolvedValue({});
    const practice = await repo.getPracticeMetrics(ctx('manager'), NOW);
    expect(practice?.incorporation.clients).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe('getPeopleMetrics', () => {
  it.each(['intern', 'client', 'developer'] as const)('%s gets nothing and no query', async (role) => {
    expect(await repo.getPeopleMetrics(ctx(role), NOW)).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('a manager reads only themselves and the leads who report to them', async () => {
    results = [[]];
    await repo.getPeopleMetrics(ctx('manager'), NOW);
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.sql).toContain('reports_to_manager_id');
    expect(q.params).toContain('user-manager');
  });

  it.each(['admin', 'super_admin'] as const)('%s reads every active manager and lead', async (role) => {
    results = [[{ id: 'm1', name: 'Mira', email: 'm@x', role: 'manager', internId: null, capacity: 5, lastSeenAt: null }]];
    listEngagements.mockResolvedValue([]);
    listChecklistIndex.mockResolvedValue({});
    const people = await repo.getPeopleMetrics(ctx(role), NOW);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ profileId: 'm1', capacity: 5, clients: 0 });
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.sql).not.toContain('reports_to_manager_id');
  });
});

describe('setPersonCapacity', () => {
  it.each(['manager', 'intern', 'client'] as const)('%s may not set capacity and nothing is written', async (role) => {
    await expect(repo.setPersonCapacity(ctx(role), 'm1', 5)).rejects.toThrow('Only an admin');
    expect(calls).toHaveLength(0);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ role }),
      expect.objectContaining({ action: 'people.capacity_set', result: 'denied' }),
    );
  });

  it('refuses a client profile without writing', async () => {
    results = [[{ id: 'c9', name: 'Client', email: 'c@x', role: 'client', capacity: null }]];
    await expect(repo.setPersonCapacity(ctx('admin'), 'c9', 5)).rejects.toThrow('not found');
    expect(calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('rejects a bad number before any read', async () => {
    await expect(repo.setPersonCapacity(ctx('admin'), 'm1', 0)).rejects.toThrow('invalid_capacity');
    expect(calls).toHaveLength(0);
  });

  it.each(['admin', 'super_admin'] as const)('%s sets a manager’s capacity with an audit event', async (role) => {
    results = [[{ id: 'm1', name: 'Mira', email: 'm@x', role: 'manager', capacity: 3 }], []];
    await expect(repo.setPersonCapacity(ctx(role), 'm1', 8)).resolves.toEqual({ profileId: 'm1', capacity: 8 });
    expect(calls.find((c) => c.op === 'update')?.set).toMatchObject({ capacity: 8 });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ role }),
      expect.objectContaining({ action: 'people.capacity_set', metadata: { profileId: 'm1', before: 3, after: 8 } }),
    );
  });
});
