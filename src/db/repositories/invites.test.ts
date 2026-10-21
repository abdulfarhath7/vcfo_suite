import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Invite scoping (product default, Path A):
 *   admin — all invites
 *   manager / intern / client — invites on engagements in their role scope
 * Creating an invite needs staff + an engagement the caller can access, and
 * the row is written against the approved engagement id.
 */

type Call = { op: string; where?: SQL; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
    set: () => c,
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

const { listInvites, createInvite } = await import('@/db/repositories/invites');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

function inviteRow(engagementId: string) {
  return {
    token: 'inv_1',
    engagementId,
    email: 'new@client.test',
    createdAt: new Date(),
    acceptedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('listInvites', () => {
  it('admin lists all without a scope lookup', async () => {
    results = [[inviteRow(OWN), inviteRow(OTHER)]];
    expect(await listInvites(ctx('admin'))).toHaveLength(2);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    expect(calls[0]!.where).toBeUndefined();
  });

  it.each(['super_admin', 'manager', 'intern', 'client'] as const)(
    '%s only sees invites on scoped engagements',
    async (role) => {
      await listInvites(ctx(role));
      const q = dialect.sqlToQuery(calls[0]!.where!);
      expect(q.sql).toContain('"invites"."engagement_id" in');
      expect(q.params).toEqual([OWN]);
    },
  );

  it.each(['manager', 'intern', 'client'] as const)(
    '%s with no engagements gets [] and no query',
    async (role) => {
      listScopedEngagementIds.mockResolvedValue([]);
      expect(await listInvites(ctx(role))).toEqual([]);
      expect(calls).toHaveLength(0);
    },
  );
});

describe('createInvite', () => {
  it('client may not create invites, even on its own engagement', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    await expect(
      createInvite(ctx('client'), { engagementId: OWN, email: 'x@y.test' }),
    ).rejects.toThrow(/clients may not/i);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'intern'] as const)(
    '%s cannot invite onto another firm’s engagement',
    async (role) => {
      assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
      await expect(
        createInvite(ctx(role), { engagementId: OTHER, email: 'x@y.test' }),
      ).rejects.toThrow(/not found or not permitted/i);
      expect(calls).toHaveLength(0);
    },
  );

  it('writes a client-role invite against the approved engagement id', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    results = [[inviteRow(OWN)]];
    await createInvite(ctx('manager'), { engagementId: 'e1', email: ' New@Client.TEST ' });
    const values = calls[0]!.values as { engagementId: string; role: string; email: string };
    expect(values.engagementId).toBe(OWN);
    expect(values.role).toBe('client');
    expect(values.email).toBe('new@client.test');
  });
});
