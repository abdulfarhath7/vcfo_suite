import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Activity feed scoping (product default, Path A):
 *   admin — firm-wide, including unscoped (null engagement) rows
 *   everyone else — only rows on engagements in their role scope
 * Writes need an engagement the caller can access; only admin / manager may
 * write an unscoped row. The actor is always the session user.
 */

type Call = { op: string; where?: SQL; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
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

vi.mock('@/db/client', () => ({
  db: { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') },
}));

const listScopedEngagementIds = vi.fn();
const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));

const { listActivity, createActivity } = await import('@/db/repositories/activity');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

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

function activityRow(engagementId: string | null) {
  return {
    id: 'a-1',
    engagementId,
    actorId: 'user-x',
    kind: 'did',
    message: 'thing',
    createdAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('listActivity', () => {
  it('admin reads firm-wide without a scope lookup or WHERE', async () => {
    results = [[{ event: activityRow(null), actorName: 'A' }]];
    const out = await listActivity(ctx('admin'));
    expect(out).toHaveLength(1);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    expect(calls[0]!.where).toBeUndefined();
  });

  it.each(['super_admin', 'manager', 'intern', 'client'] as const)(
    '%s is filtered to its scoped engagement ids',
    async (role) => {
      await listActivity(ctx(role));
      expect(listScopedEngagementIds).toHaveBeenCalledWith(ctx(role));
      const q = dialect.sqlToQuery(calls[0]!.where!);
      expect(q.sql).toContain('"activity"."engagement_id" in');
      expect(q.params).toEqual([OWN]);
      expect(q.params).not.toContain(OTHER);
    },
  );

  it.each(['manager', 'intern', 'client'] as const)(
    '%s with no engagements gets [] and no activity query',
    async (role) => {
      listScopedEngagementIds.mockResolvedValue([]);
      expect(await listActivity(ctx(role))).toEqual([]);
      expect(calls).toHaveLength(0);
    },
  );
});

describe('createActivity', () => {
  it.each(['manager', 'intern', 'client'] as const)(
    '%s cannot write onto another firm’s engagement',
    async (role) => {
      assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
      await expect(createActivity(ctx(role), { engagementId: OTHER, verb: 'x' })).rejects.toThrow(
        /not found or not permitted/i,
      );
      expect(calls.filter((c) => c.op === 'insert')).toHaveLength(0);
    },
  );

  it('writes against the approved engagement id with the session user as actor', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    results = [[activityRow(OWN)]];
    await createActivity(ctx('client'), { engagementId: 'e1', verb: 'uploaded', actor: 'Spoof' });
    const values = calls[0]!.values as { engagementId: string; actorId: string };
    expect(values.engagementId).toBe(OWN);
    expect(values.actorId).toBe('user-client');
  });

  it.each(['intern', 'client'] as const)('%s may not write an unscoped row', async (role) => {
    await expect(createActivity(ctx(role), { verb: 'x' })).rejects.toThrow(/engagement required/i);
    expect(calls).toHaveLength(0);
  });

  it.each(['admin', 'manager'] as const)('%s may write an unscoped row', async (role) => {
    results = [[activityRow(null)]];
    await createActivity(ctx(role), { verb: 'x' });
    expect((calls[0]!.values as { engagementId: unknown }).engagementId).toBeNull();
  });
});
