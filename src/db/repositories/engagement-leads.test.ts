import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for project-lead membership.
 *
 *   - list: anyone who passes `assertEngagementAccess` (incl. the client and
 *     the lead themselves); everyone else gets "not found or not permitted".
 *   - add / replace / remove: admin, super_admin or manager only — leads and
 *     clients are refused before the access check runs — and only on an
 *     engagement the caller can access.
 *   - every read and write uses the approved db id, never the raw id sent.
 */

const assertEngagementAccess = vi.fn();
const resolveInternScopingId = vi.fn();
const ensureEngagementLead = vi.fn();

const selectWheres: SQL[] = [];
const writeWheres: SQL[] = [];
const writes: string[] = [];
let selectRows: unknown[] = [];

function selectChain(): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    where: (w: SQL) => {
      selectWheres.push(w);
      return c;
    },
    orderBy: () => c,
    limit: () => c,
    then: (resolve: (v: unknown[]) => unknown) => resolve(selectRows),
  };
  return c;
}

function writeChain(kind: string): unknown {
  writes.push(kind);
  const c: Record<string, unknown> = {
    set: () => c,
    where: (w: SQL) => {
      writeWheres.push(w);
      return c;
    },
    then: (resolve: (v: unknown[]) => unknown) => resolve([]),
  };
  return c;
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => selectChain(),
    update: () => writeChain('update'),
    delete: () => writeChain('delete'),
  },
}));
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));
vi.mock('@/db/repositories/profiles', () => ({
  resolveInternScopingId: (...a: unknown[]) => resolveInternScopingId(...a),
}));
vi.mock('@/db/repositories/engagement-leads-membership', () => ({
  ensureEngagementLead: (...a: unknown[]) => ensureEngagementLead(...a),
}));

const repo = await import('@/db/repositories/engagement-leads');

const dialect = new PgDialect();
const render = (w: SQL) => dialect.sqlToQuery(w);

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

const forbidden = { ok: false, dbId: OTHER, forbidden: true };

beforeEach(() => {
  vi.clearAllMocks();
  selectWheres.length = 0;
  writeWheres.length = 0;
  writes.length = 0;
  selectRows = [];
  resolveInternScopingId.mockImplementation(async (k: string) => k);
});

describe('listEngagementLeads', () => {
  it.each(['client', 'intern', 'manager'] as const)(
    '%s on an engagement outside scope: throws without reading',
    async (role) => {
      assertEngagementAccess.mockResolvedValue(forbidden);
      await expect(repo.listEngagementLeads(ctx(role), OTHER)).rejects.toThrow(
        /not found or not permitted/,
      );
      expect(selectWheres).toHaveLength(0);
    },
  );

  it('reads leads of the approved db id and marks the primary', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { internId: 'i1' } });
    selectRows = [
      { internId: 'i1', createdAt: new Date(), email: 'a@x', name: 'A', profileId: 'p1' },
      { internId: 'i2', createdAt: new Date(), email: 'b@x', name: 'B', profileId: 'p2' },
    ];
    const out = await repo.listEngagementLeads(ctx('client'), 'e1');
    expect(render(selectWheres[0]!)).toMatchObject({
      sql: '"engagement_leads"."engagement_id" = $1',
      params: [OWN],
    });
    expect(out.map((l) => [l.internId, l.isPrimary])).toEqual([
      ['i1', true],
      ['i2', false],
    ]);
  });
});

describe('add / replace / remove', () => {
  const calls = {
    add: (c: AuthContext, id: string) => repo.addEngagementLead(c, id, 'i9'),
    replace: (c: AuthContext, id: string) => repo.replaceEngagementLead(c, id, 'i1', 'i9'),
    remove: (c: AuthContext, id: string) => repo.removeEngagementLead(c, id, 'i1'),
  };

  describe.each(Object.entries(calls))('%s', (_name, call) => {
    it.each(['client', 'intern'] as const)('refuses %s before the access check', async (role) => {
      await expect(call(ctx(role), OWN)).rejects.toThrow('Not permitted');
      expect(assertEngagementAccess).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
      expect(ensureEngagementLead).not.toHaveBeenCalled();
    });

    it.each(['manager', 'admin', 'super_admin'] as const)(
      '%s cannot touch an engagement outside scope',
      async (role) => {
        assertEngagementAccess.mockResolvedValue(forbidden);
        await expect(call(ctx(role), OTHER)).rejects.toThrow(/not found or not permitted/);
        expect(writes).toEqual([]);
        expect(ensureEngagementLead).not.toHaveBeenCalled();
        expect(resolveInternScopingId).not.toHaveBeenCalled();
      },
    );
  });

  it('add writes membership against the approved db id', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { internId: 'i1' } });
    await repo.addEngagementLead(ctx('manager'), 'e1', 'i9');
    expect(ensureEngagementLead).toHaveBeenCalledWith({
      engagementDbId: OWN,
      internId: 'i9',
      invitedBy: 'user-manager',
    });
    expect(writes).toEqual([]); // primary already set — no engagements update
  });

  it('remove deletes only the (approved engagement, lead) pair', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { internId: 'i2' } });
    await repo.removeEngagementLead(ctx('manager'), 'e1', 'i1');
    expect(writes).toEqual(['delete']);
    const q = render(writeWheres[0]!);
    expect(q.sql).toBe(
      '("engagement_leads"."engagement_id" = $1 and "engagement_leads"."intern_id" = $2)',
    );
    expect(q.params).toEqual([OWN, 'i1']);
  });

  it('replace deletes the old lead and promotes the new one on the approved id only', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { internId: 'i1' } });
    await repo.replaceEngagementLead(ctx('admin'), 'e1', 'i1', 'i9');
    expect(writes).toEqual(['delete', 'update']);
    expect(render(writeWheres[0]!).params).toEqual([OWN, 'i1']);
    expect(render(writeWheres[1]!)).toMatchObject({
      sql: '"engagements"."id" = $1',
      params: [OWN],
    });
    expect(ensureEngagementLead).toHaveBeenCalledWith(
      expect.objectContaining({ engagementDbId: OWN, internId: 'i9' }),
    );
  });
});
