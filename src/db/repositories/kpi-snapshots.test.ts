import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * KPI snapshot scoping (migration 0028, S-618): a caller reads exactly one scope chosen from
 * the role ('firm' for firm-wide admins, the caller's own profile id for a manager or a lead);
 * clients and developers read nothing and make no query.
 */

type Call = { op: string; where?: SQL };
const calls: Call[] = [];
let results: unknown[][] = [];
function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    values: () => c,
    onConflictDoUpdate: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}
const op = (name: string) => () => {
  const call: Call = { op: name };
  calls.push(call);
  return chain(call);
};
vi.mock('@/db/client', () => ({ db: { select: op('select'), insert: op('insert') } }));

const repo = await import('@/db/repositories/kpi-snapshots');
const dialect = new PgDialect();
const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role });

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('getKpiSnapshot', () => {
  it.each([
    ['admin', 'firm'],
    ['super_admin', 'firm'],
    ['manager', 'user-manager'],
    ['intern', 'user-intern'],
  ] as const)('reads only the %s scope', async (role, scope) => {
    results = [[{ key: 'projects', value: '12' }]];
    const out = await repo.getKpiSnapshot(ctx(role), '2026-09-30');
    expect(out).toEqual({ projects: 12 });
    const params = dialect.sqlToQuery(calls[0]!.where!).params;
    expect(params).toContain(scope);
    for (const other of ['firm', 'user-manager', 'user-intern'].filter((s) => s !== scope)) expect(params).not.toContain(other);
  });

  it.each(['client', 'developer'] as const)('reads nothing for %s', async (role) => {
    expect(await repo.getKpiSnapshot(ctx(role), '2026-09-30')).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it('refuses a malformed period without a query', async () => {
    expect(await repo.getKpiSnapshot(ctx('admin'), 'last month')).toEqual({});
    expect(calls).toHaveLength(0);
  });
});
