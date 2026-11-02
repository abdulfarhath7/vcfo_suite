import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for the "Before filing" ticks (migration 0028, S-783, S-816): staff
 * only, through `assertEngagementAccess`; a foreign engagement reads as no ticks and a write
 * to it changes nothing; clients and developers are refused before any query; writes use the
 * approved engagement id.
 */

type Call = { op: string; where?: SQL; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];
function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    onConflictDoNothing: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    values: (v: unknown) => {
      call.values = v;
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
vi.mock('@/db/client', () => ({ db: { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') } }));

const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));

const repo = await import('@/db/repositories/compliance-checklist-checks');
const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role });
const subject = (engagementId: string) => ({ engagementId, subjectKind: 'registration' as const, subjectKey: 'reg-4' });

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('compliance checklist ticks', () => {
  it.each(['client', 'developer'] as const)('refuses %s before any query', async (role) => {
    await expect(repo.listChecklistTicks(ctx(role), subject(OWN))).rejects.toThrow();
    await expect(repo.setChecklistTick(ctx(role), { ...subject(OWN), itemKey: 'documents', checked: true })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'intern'] as const)('reads a foreign engagement as no ticks and writes nothing (%s)', async (role) => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
    expect(await repo.listChecklistTicks(ctx(role), subject(OTHER))).toEqual([]);
    expect(await repo.setChecklistTick(ctx(role), { ...subject(OTHER), itemKey: 'documents', checked: true })).toBe(false);
    expect(await repo.setChecklistTick(ctx(role), { ...subject(OTHER), itemKey: 'documents', checked: false })).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'intern', 'admin', 'super_admin'] as const)('reads and writes against the approved engagement (%s)', async (role) => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN });
    results = [[{ itemKey: 'documents', checkedBy: 'Asha', checkedAt: new Date('2026-10-14T05:00:00Z') }]];
    const ticks = await repo.listChecklistTicks(ctx(role), { ...subject('e1') });
    expect(ticks).toEqual([{ itemKey: 'documents', checkedBy: 'Asha', checkedAt: '2026-10-14T05:00:00.000Z' }]);
    const read = dialect.sqlToQuery(calls[0]!.where!).params;
    expect(read).toContain(OWN);
    expect(read).not.toContain(OTHER);

    expect(await repo.setChecklistTick(ctx(role), { ...subject('e1'), itemKey: 'documents', checked: true })).toBe(true);
    expect(calls.find((c) => c.op === 'insert')?.values).toMatchObject({ engagementId: OWN, itemKey: 'documents', checkedBy: `user-${role}` });
    await repo.setChecklistTick(ctx(role), { ...subject('e1'), itemKey: 'documents', checked: false });
    expect(dialect.sqlToQuery(calls.find((c) => c.op === 'delete')!.where!).params).toContain(OWN);
  });

  it('ignores a malformed key without a query', async () => {
    expect(await repo.setChecklistTick(ctx('manager'), { ...subject(OWN), itemKey: "x'; drop", checked: true })).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
