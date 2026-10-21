import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for document requests (product default, Path A):
 *   super_admin / admin — all requests
 *   manager / intern / client — requests on engagements in their role scope
 * A single request is readable or writable only through an engagement the
 * caller can access (`assertEngagementAccess`). Creating needs staff, and the
 * row is written against the approved engagement id. Clients may only mark a
 * request as uploaded.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
    onConflictDoNothing: () => c,
    set: (s: unknown) => {
      call.set = s;
      return c;
    },
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

const repo = await import('@/db/repositories/document-requests');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

function requestRow(engagementId: string, id = 'req-1') {
  return {
    id,
    engagementId,
    requestedBy: 'user-manager',
    title: 'PAN card',
    detail: null,
    status: 'pending',
    createdAt: new Date(),
  };
}

const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('listDocumentRequests', () => {
  // Regression (2026-10-22): super_admin used to fall through to the scoped
  // lookup because the branch tested `ctx.role === 'admin'` only.
  it.each(['admin', 'super_admin'] as const)('%s lists all without a scope lookup', async (role) => {
    results = [[requestRow(OWN), requestRow(OTHER, 'req-2')]];
    expect(await repo.listDocumentRequests(ctx(role))).toHaveLength(2);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    expect(calls[0]!.where).toBeUndefined();
  });

  it.each(['manager', 'intern', 'client'] as const)(
    '%s only sees requests on its scoped engagements',
    async (role) => {
      await repo.listDocumentRequests(ctx(role));
      expect(listScopedEngagementIds).toHaveBeenCalledWith(ctx(role));
      const q = dialect.sqlToQuery(calls[0]!.where!);
      expect(q.sql).toContain('"document_requests"."engagement_id" in');
      expect(q.params).toEqual([OWN]);
      expect(q.params).not.toContain(OTHER);
    },
  );

  it.each(['manager', 'intern', 'client'] as const)(
    '%s with no engagements gets [] and no request query',
    async (role) => {
      listScopedEngagementIds.mockResolvedValue([]);
      expect(await repo.listDocumentRequests(ctx(role))).toEqual([]);
      expect(calls).toHaveLength(0);
    },
  );
});

describe('getDocumentRequestById', () => {
  it.each(['manager', 'intern', 'client'] as const)(
    '%s gets null for a request on another firm’s engagement',
    async (role) => {
      results = [[requestRow(OTHER)]];
      assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
      expect(await repo.getDocumentRequestById(ctx(role), 'req-1')).toBeNull();
      expect(assertEngagementAccess).toHaveBeenCalledWith(ctx(role), OTHER);
    },
  );

  it('returns a request on an accessible engagement', async () => {
    results = [[requestRow(OWN)]];
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    expect(await repo.getDocumentRequestById(ctx('client'), 'req-1')).toMatchObject({ id: 'req-1' });
  });
});

describe('createDocumentRequest', () => {
  it('client may not create, even on its own engagement', async () => {
    await expect(
      repo.createDocumentRequest(ctx('client'), { engagementId: OWN, label: 'PAN' }),
    ).rejects.toThrow(/clients may not/i);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'intern'] as const)(
    '%s cannot create on another firm’s engagement',
    async (role) => {
      assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
      await expect(
        repo.createDocumentRequest(ctx(role), { engagementId: OTHER, label: 'PAN' }),
      ).rejects.toThrow(/not found or not permitted/i);
      expect(calls).toHaveLength(0);
    },
  );

  it('writes against the approved engagement id with the session user as requester', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    results = [[requestRow(OWN)]];
    await repo.createDocumentRequest(ctx('manager'), { engagementId: 'e1', label: 'PAN' });
    const values = calls[0]!.values as { engagementId: string; requestedBy: string };
    expect(values.engagementId).toBe(OWN);
    expect(values.requestedBy).toBe('user-manager');
  });
});

describe('updateDocumentRequest', () => {
  it.each(['manager', 'intern', 'client'] as const)(
    '%s cannot update a request on another firm’s engagement, and nothing is written',
    async (role) => {
      results = [[requestRow(OTHER)]];
      assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
      expect(await repo.updateDocumentRequest(ctx(role), 'req-1', { status: 'uploaded' })).toBeNull();
      expect(writes()).toHaveLength(0);
    },
  );

  it('client may only mark its own request as uploaded', async () => {
    results = [[requestRow(OWN)]];
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    await expect(
      repo.updateDocumentRequest(ctx('client'), 'req-1', { status: 'approved' }),
    ).rejects.toThrow(/only mark requests as uploaded/i);
    expect(writes()).toHaveLength(0);
  });
});
