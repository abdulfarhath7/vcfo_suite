import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Role scope for project change requests (docs/context/notes/data-access.md):
 *   - file: manager / admin / super_admin, and only against an engagement
 *     `assertEngagementAccess` approves — written against the approved db id;
 *   - read: admins see every request; a manager sees only their own;
 *     leads and clients see nothing;
 *   - decide approve/reject: firm admins only; cancel: only the requester.
 */

const assertEngagementAccess = vi.fn();
const wheres: SQL[] = [];
const writes: string[] = [];
let inserted: Record<string, unknown> | null = null;
let rows: unknown[] = [];

function chain(kind?: string): unknown {
  if (kind) writes.push(kind);
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    where: (w: SQL) => {
      wheres.push(w);
      return c;
    },
    orderBy: () => c,
    limit: () => c,
    set: () => c,
    values: (v: Record<string, unknown>) => {
      inserted = v;
      return c;
    },
    returning: () => c,
    then: (resolve: (v: unknown[]) => unknown) => resolve(rows),
  };
  return c;
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => chain(),
    insert: () => chain('insert'),
    update: () => chain('update'),
  },
}));
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));

const repo = await import('@/db/repositories/engagement-change-requests');

const dialect = new PgDialect();
const lastWhere = () => dialect.sqlToQuery(wheres.at(-1)!);

const OWN = '11111111-1111-1111-1111-111111111101'; // legacy "e1"
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

const createInput = {
  engagementId: OTHER,
  kind: 'delete_project' as const,
  payload: {},
  preview: {} as never,
};

beforeEach(() => {
  vi.clearAllMocks();
  wheres.length = 0;
  writes.length = 0;
  inserted = null;
  rows = [];
});

describe('createChangeRequest', () => {
  it.each(['intern', 'client'] as const)('refuses %s before the access check', async (role) => {
    await expect(repo.createChangeRequest(ctx(role), createInput)).rejects.toThrow('not_permitted');
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it('manager on another manager’s project → not_permitted, nothing written', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
    await expect(repo.createChangeRequest(ctx('manager'), createInput)).rejects.toThrow(
      'not_permitted',
    );
    expect(writes).toEqual([]);
  });

  it('unknown / soft-deleted project → not_found, nothing written', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, notFound: true });
    await expect(repo.createChangeRequest(ctx('admin'), createInput)).rejects.toThrow('not_found');
    expect(writes).toEqual([]);
  });

  it('writes against the approved db id with the caller as requester', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    rows = [{ id: 'cr-1' }];
    await repo.createChangeRequest(ctx('manager'), { ...createInput, engagementId: 'e1' });
    expect(assertEngagementAccess).toHaveBeenCalledWith(expect.objectContaining({ role: 'manager' }), 'e1');
    expect(inserted).toMatchObject({
      engagementId: OWN,
      requestedBy: 'user-manager',
      status: 'pending',
    });
  });
});

describe('listChangeRequests', () => {
  it.each(['intern', 'client'] as const)('%s sees nothing and queries nothing', async (role) => {
    await expect(repo.listChangeRequests(ctx(role))).resolves.toEqual([]);
    expect(wheres).toHaveLength(0);
  });

  it('manager is limited to requests they filed', async () => {
    await repo.listChangeRequests(ctx('manager'));
    const q = lastWhere();
    expect(q.sql).toContain('"engagement_change_requests"."requested_by" = $2');
    expect(q.params).toEqual(['pending', 'user-manager']);
  });

  it('manager filtering by engagement still keeps the requester filter', async () => {
    await repo.listChangeRequests(ctx('manager'), { engagementId: 'e1', statuses: ['pending', 'approved'] });
    const q = lastWhere();
    expect(q.sql).toContain('"requested_by" = $3');
    expect(q.sql).toContain('"engagement_id" = $4');
    expect(q.params).toEqual(['pending', 'approved', 'user-manager', OWN]);
  });

  it.each(['admin', 'super_admin'] as const)('%s sees every requester', async (role) => {
    await repo.listChangeRequests(ctx(role));
    const q = lastWhere();
    expect(q.sql).not.toContain('requested_by');
    expect(q.params).toEqual(['pending']);
  });
});

describe('getChangeRequest', () => {
  it.each(['intern', 'client'] as const)('%s gets null without a query', async (role) => {
    await expect(repo.getChangeRequest(ctx(role), 'cr-1')).resolves.toBeNull();
    expect(wheres).toHaveLength(0);
  });

  it('manager can only read their own request (another manager’s is null)', async () => {
    rows = [];
    await expect(repo.getChangeRequest(ctx('manager'), 'cr-1')).resolves.toBeNull();
    const q = lastWhere();
    expect(q.sql).toBe(
      '("engagement_change_requests"."id" = $1 and "engagement_change_requests"."requested_by" = $2)',
    );
    expect(q.params).toEqual(['cr-1', 'user-manager']);
  });

  it('admin reads by id alone', async () => {
    await repo.getChangeRequest(ctx('admin'), 'cr-1');
    expect(lastWhere()).toMatchObject({ sql: '"engagement_change_requests"."id" = $1', params: ['cr-1'] });
  });
});

describe('decideChangeRequest', () => {
  it.each(['manager', 'intern', 'client'] as const)(
    '%s may not approve or reject',
    async (role) => {
      await expect(repo.decideChangeRequest(ctx(role), 'cr-1', 'approved')).rejects.toThrow(
        'not_permitted',
      );
      await expect(repo.decideChangeRequest(ctx(role), 'cr-1', 'rejected')).rejects.toThrow(
        'not_permitted',
      );
      expect(writes).toEqual([]);
    },
  );

  it('admin decision is guarded on status = pending', async () => {
    await repo.decideChangeRequest(ctx('admin'), 'cr-1', 'approved');
    const q = lastWhere();
    expect(q.sql).toBe(
      '("engagement_change_requests"."id" = $1 and "engagement_change_requests"."status" = $2)',
    );
    expect(q.params).toEqual(['cr-1', 'pending']);
  });

  it.each(['manager', 'admin'] as const)('%s can only cancel a request they filed', async (role) => {
    rows = []; // someone else's request: guarded update matches nothing
    await expect(repo.decideChangeRequest(ctx(role), 'cr-1', 'cancelled')).resolves.toBeNull();
    const q = lastWhere();
    expect(q.sql).toContain('"engagement_change_requests"."requested_by" = $3');
    expect(q.params).toEqual(['cr-1', 'pending', `user-${role}`]);
  });
});
