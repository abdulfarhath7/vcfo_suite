import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/** Mark unread is per-user (Path A): only the caller's own rows, for every role. */

type Call = { op: string; where?: SQL; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    returning: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    set: (s: unknown) => {
      call.set = s;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}

vi.mock('@/db/client', () => ({
  db: {
    update: () => {
      const call: Call = { op: 'update' };
      calls.push(call);
      return chain(call);
    },
  },
}));

const repo = await import('@/db/repositories/notifications-unread');
const dialect = new PgDialect();

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('markNotificationsUnread', () => {
  it.each(['super_admin', 'admin', 'manager', 'intern', 'client'] as const)('scopes to the caller for %s', async (role) => {
    results = [[{ id: 'n-1' }]];
    const n = await repo.markNotificationsUnread(ctx(role), ['n-1', 'n-of-someone-else']);
    expect(n).toBe(1);
    expect(calls[0]?.set).toEqual({ status: 'unread' });
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.sql).toMatch(/"user_id" = \$1/);
    expect(q.params[0]).toBe(`user-${role}`);
    expect(q.params).toContain('n-of-someone-else');
  });

  it('does nothing for an empty list', async () => {
    expect(await repo.markNotificationsUnread(ctx('manager'), [])).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
