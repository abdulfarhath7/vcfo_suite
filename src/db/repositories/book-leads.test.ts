import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Book leads (Path A):
 *   - the only scope source is `listScopedEngagementIds(ctx)`; every read is
 *     restricted to those ids, so a manager never sees another book's leads;
 *   - clients are refused before anything is read;
 *   - an empty scope reads nothing;
 *   - leads come from membership rows plus the primary pointer, de-duplicated,
 *     with names from profiles (falling back to the e-mail, then the key).
 */

const listScopedEngagementIds = vi.fn();

const wheres: SQL[] = [];
let results: unknown[][] = [];

function selectChain(): unknown {
  const rows = results.shift() ?? [];
  const c: Record<string, unknown> = {
    from: () => c,
    where: (w: SQL) => {
      wheres.push(w);
      return c;
    },
    then: (resolve: (v: unknown[]) => unknown) => resolve(rows),
  };
  return c;
}

vi.mock('@/db/client', () => ({ db: { select: () => selectChain() } }));
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
}));

const repo = await import('@/db/repositories/book-leads');

const dialect = new PgDialect();
const render = (w: SQL) => dialect.sqlToQuery(w);

const MINE_A = '11111111-1111-1111-1111-1111111111a1';
const MINE_B = '11111111-1111-1111-1111-1111111111b2';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

beforeEach(() => {
  vi.clearAllMocks();
  wheres.length = 0;
  results = [];
});

describe('listBookLeads', () => {
  it('refuses a client without reading', async () => {
    await expect(repo.listBookLeads(ctx('client'))).rejects.toThrow(/not permitted/);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    expect(wheres).toHaveLength(0);
  });

  it('reads nothing when the caller has no engagements in scope', async () => {
    listScopedEngagementIds.mockResolvedValue([]);
    expect(await repo.listBookLeads(ctx('manager'))).toEqual([]);
    expect(wheres).toHaveLength(0);
  });

  it('restricts membership and primary reads to the scoped ids (no other book leaks in)', async () => {
    listScopedEngagementIds.mockResolvedValue([MINE_A, MINE_B]);
    results = [[{ internId: 'lead-a' }], [{ internId: 'lead-a' }, { internId: null }], []];
    await repo.listBookLeads(ctx('manager'));
    expect(listScopedEngagementIds).toHaveBeenCalledWith(expect.objectContaining({ role: 'manager' }));
    expect(render(wheres[0]!)).toMatchObject({
      sql: '"engagement_leads"."engagement_id" in ($1, $2)',
      params: [MINE_A, MINE_B],
    });
    expect(render(wheres[1]!)).toMatchObject({
      sql: '"engagements"."id" in ($1, $2)',
      params: [MINE_A, MINE_B],
    });
  });

  it('merges membership and primary keys, names them from profiles and sorts by name', async () => {
    listScopedEngagementIds.mockResolvedValue([MINE_A]);
    results = [
      [{ internId: 'lead-z' }, { internId: 'lead-a' }],
      [{ internId: 'lead-a' }, { internId: ' lead-n ' }],
      [
        { id: 'p-z', internId: 'lead-z', name: 'Zara Iyer', email: 'z@x' },
        { id: 'p-a', internId: 'lead-a', name: '  ', email: 'arjun@x' },
        { id: 'p-a2', internId: 'lead-a', name: 'Duplicate', email: 'dup@x' },
      ],
    ];
    const out = await repo.listBookLeads(ctx('admin'));
    expect(render(wheres[2]!)).toMatchObject({ sql: '"profiles"."intern_id" in ($1, $2, $3)' });
    expect(out).toEqual([
      { internId: 'lead-a', name: 'arjun@x', email: 'arjun@x', profileId: 'p-a' },
      { internId: 'lead-n', name: 'lead-n', email: '', profileId: null },
      { internId: 'lead-z', name: 'Zara Iyer', email: 'z@x', profileId: 'p-z' },
    ]);
  });
});
