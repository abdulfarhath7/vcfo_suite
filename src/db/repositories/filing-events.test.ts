import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for filing events (migration 0028, S-771):
 *   write — only through an instance whose engagement the caller reaches; a foreign
 *           instance writes nothing; developers write nothing.
 *   read  — firm-wide admins read the ids asked for; managers, leads and clients read only
 *           instances of the engagements in their scope; developers read nothing.
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

const listScopedEngagementIds = vi.fn();
const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));

const repo = await import('@/db/repositories/filing-events');
const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const OWN_INST = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
const OTHER_INST = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}
const params = (w?: SQL) => (w ? dialect.sqlToQuery(w).params : []);

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('recordFilingEvent', () => {
  it('writes an event on an instance in scope, against the stored instance id', async () => {
    results = [[{ id: OWN_INST, engagementId: OWN }]];
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN });
    await repo.recordFilingEvent(ctx('manager'), { instanceId: OWN_INST, side: 'sbc', label: 'Filed' });
    const insert = calls.find((c) => c.op === 'insert');
    expect(insert?.values).toMatchObject({ instanceId: OWN_INST, side: 'sbc', label: 'Filed', actorId: 'user-manager' });
  });

  it.each(['manager', 'intern', 'client'] as const)('writes nothing on a foreign instance (%s)', async (role) => {
    results = [[{ id: OTHER_INST, engagementId: OTHER }]];
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
    await repo.recordFilingEvent(ctx(role), { instanceId: OTHER_INST, side: 'client', label: 'Proof sent' });
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('writes nothing for a developer', async () => {
    await repo.recordFilingEvent(ctx('developer'), { instanceId: OWN_INST, side: 'sbc', label: 'Filed' });
    expect(calls).toHaveLength(0);
  });
});

describe('listFilingEvents', () => {
  it.each(['manager', 'intern', 'client'] as const)('drops instances outside the scope (%s)', async (role) => {
    listScopedEngagementIds.mockResolvedValue([OWN]);
    results = [
      [
        { id: OWN_INST, engagementId: OWN },
        { id: OTHER_INST, engagementId: OTHER },
      ],
      [],
    ];
    await repo.listFilingEvents(ctx(role), [OWN_INST, OTHER_INST]);
    const last = calls.at(-1)!;
    expect(params(last.where)).toContain(OWN_INST);
    expect(params(last.where)).not.toContain(OTHER_INST);
  });

  it('reads nothing when only foreign ids are asked for', async () => {
    listScopedEngagementIds.mockResolvedValue([OWN]);
    results = [[{ id: OTHER_INST, engagementId: OTHER }]];
    expect(await repo.listFilingEvents(ctx('manager'), [OTHER_INST])).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('reads nothing with an empty scope', async () => {
    listScopedEngagementIds.mockResolvedValue([]);
    expect(await repo.listFilingEvents(ctx('intern'), [OWN_INST])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it.each(['admin', 'super_admin'] as const)('reads the asked ids firm-wide (%s)', async (role) => {
    results = [[{ id: 'e1', instanceId: OWN_INST, side: 'client', label: 'Proof sent', actorName: 'Asha', at: new Date('2026-10-14T05:00:00Z') }]];
    const out = await repo.listFilingEvents(ctx(role), [OWN_INST]);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    expect(out).toEqual([{ id: 'e1', instanceId: OWN_INST, side: 'client', label: 'Proof sent', actorName: 'Asha', at: '2026-10-14T05:00:00.000Z' }]);
  });

  it('reads nothing for a developer', async () => {
    expect(await repo.listFilingEvents(ctx('developer'), [OWN_INST])).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('windowEventLabel', () => {
  it('writes plain dates', () => {
    expect(repo.windowEventLabel({ from: '2026-10-09', to: '2026-10-14' }, 'sbc')).toBe('Working window 9 Oct to 14 Oct');
    expect(repo.windowEventLabel(null, 'client')).toBe('Planning window reset');
  });
});
