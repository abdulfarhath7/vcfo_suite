import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Client account extras (Profile › About you and Notifications, migration 0028):
 * client role only, and every read and write is keyed by the caller's own id.
 */

type Call = { op: string; where?: SQL; set?: Record<string, unknown>; values?: Record<string, unknown> };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    limit: () => c,
    set: (s: Record<string, unknown>) => {
      call.set = s;
      return c;
    },
    values: (v: Record<string, unknown>) => {
      call.values = v;
      return c;
    },
    onConflictDoUpdate: (o: { set: Record<string, unknown> }) => {
      call.set = o.set;
      return c;
    },
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}

vi.mock('server-only', () => ({}));
vi.mock('@/db/client', () => {
  const op = (name: string) => () => {
    const call: Call = { op: name };
    calls.push(call);
    return chain(call);
  };
  return { db: { select: op('select'), update: op('update'), insert: op('insert') } };
});

const { getOwnClientAccount, updateOwnClientAccount } = await import('@/db/repositories/client-account');

const dialect = new PgDialect();
const ME = '11111111-1111-1111-1111-111111111101';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: ME, email: `${role}@vcfo.local`, name: role, role, clientId: role === 'client' ? 'c1' : undefined };
}

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('client account extras', () => {
  it.each(['admin', 'manager', 'intern', 'super_admin'] as const)('%s is refused with no query', async (role) => {
    await expect(getOwnClientAccount(ctx(role))).rejects.toMatchObject({ status: 403 });
    await expect(updateOwnClientAccount(ctx(role), { designation: 'Director' })).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });

  it('reads only the caller’s own rows', async () => {
    results = [[{ designation: ' Director ' }], [{ remindDays: 7 }]];
    expect(await getOwnClientAccount(ctx('client'))).toEqual({ designation: 'Director', remindDays: 7 });
    for (const c of calls) {
      const q = dialect.sqlToQuery(c.where!);
      expect(q.params).toEqual([ME]);
    }
  });

  it('writes the designation on the own client profile only', async () => {
    results = [[], [{ designation: 'Finance' }], []];
    await updateOwnClientAccount(ctx('client'), { designation: '  Finance ' });
    const up = calls.find((c) => c.op === 'update')!;
    expect(up.set).toMatchObject({ designation: 'Finance' });
    const q = dialect.sqlToQuery(up.where!);
    expect(q.sql).toContain('"profiles"."id" =');
    expect(q.sql).toContain('"profiles"."role" =');
    expect(q.params).toContain(ME);
  });

  it('stores remind days for the caller and refuses other values', async () => {
    results = [[], [{ designation: null }], [{ remindDays: 3 }]];
    expect((await updateOwnClientAccount(ctx('client'), { remindDays: 3 })).remindDays).toBe(3);
    const ins = calls.find((c) => c.op === 'insert')!;
    expect(ins.values).toMatchObject({ profileId: ME, remindDays: 3 });
    calls.length = 0;
    await expect(updateOwnClientAccount(ctx('client'), { remindDays: 5 })).rejects.toMatchObject({ status: 400 });
    expect(calls.filter((c) => c.op !== 'select')).toHaveLength(0);
  });
});
