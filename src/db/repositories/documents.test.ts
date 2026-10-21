import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for the documents index (product default, Path A):
 *   super_admin / admin — all files on live projects
 *   manager — files on owned engagements (manager_id = self, legacy admin_id) + co-manager membership
 *   intern — files on assigned engagements (intern_id) + lead membership
 *   client — shared_with_client files on its own engagement only
 * Files on a soft-deleted project are hidden from every list. A single file,
 * a per-engagement list and every write go through `assertEngagementAccess`
 * or `getEngagementById`, so another firm's engagement reads as not found.
 */

type Call = { op: string; where?: SQL; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    innerJoin: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
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

const assertEngagementAccess = vi.fn();
const getEngagementById = vi.fn();
const listLeadMemberEngagementIds = vi.fn();
const listManagerMemberEngagementIds = vi.fn();
vi.mock('@/db/repositories/engagements', async () => {
  const { eq } = await import('drizzle-orm');
  const { engagements } = await import('@/db/schema');
  return {
    assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
    getEngagementById: (...a: unknown[]) => getEngagementById(...a),
    managerOwnsEngagement: (userId: string) => eq(engagements.managerId, userId),
  };
});
vi.mock('@/db/repositories/engagement-leads-membership', () => ({
  listLeadMemberEngagementIds: (...a: unknown[]) => listLeadMemberEngagementIds(...a),
}));
vi.mock('@/db/repositories/engagement-managers-membership', () => ({
  listManagerMemberEngagementIds: (...a: unknown[]) => listManagerMemberEngagementIds(...a),
}));

const repo = await import('@/db/repositories/documents');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return {
    userId: `user-${role}`,
    email: `${role}@vcfo.local`,
    name: role,
    role,
    internId: role === 'intern' ? 'i-own' : undefined,
    clientId: role === 'client' ? 'c-own' : undefined,
  };
}

function docRow(engagementId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    engagementId,
    category: null,
    fileName: 'coi.pdf',
    objectKey: `engagements/${engagementId}/coi.pdf`,
    contentType: 'application/pdf',
    sizeBytes: 10,
    uploadedBy: 'user-x',
    stepId: null,
    sharedWithClient: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function rendered(call: Call | undefined) {
  if (!call?.where) throw new Error('no WHERE captured');
  return dialect.sqlToQuery(call.where);
}

const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  listLeadMemberEngagementIds.mockResolvedValue([]);
  listManagerMemberEngagementIds.mockResolvedValue([]);
});

describe('listDocuments (vault list, no engagement id)', () => {
  it.each(['admin', 'super_admin'] as const)('%s is firm-wide but skips soft-deleted projects', async (role) => {
    await repo.listDocuments(ctx(role));
    const q = rendered(calls[0]);
    expect(q.sql).toBe('"engagements"."deleted_at" is null');
    expect(q.params).toEqual([]);
  });

  it('manager is scoped to its own engagements, never another manager’s', async () => {
    await repo.listDocuments(ctx('manager'));
    const q = rendered(calls[0]);
    expect(q.sql).toContain('"engagements"."deleted_at" is null');
    expect(q.sql).toContain('"engagements"."manager_id" =');
    expect(q.params).toEqual(['user-manager']);
  });

  it('manager co-manager membership widens scope to exactly those ids', async () => {
    listManagerMemberEngagementIds.mockResolvedValue([OWN]);
    await repo.listDocuments(ctx('manager'));
    const q = rendered(calls[0]);
    expect(q.params).toEqual(['user-manager', OWN]);
    expect(q.params).not.toContain(OTHER);
  });

  it('intern is scoped to its intern_id plus lead membership', async () => {
    listLeadMemberEngagementIds.mockResolvedValue([OWN]);
    await repo.listDocuments(ctx('intern'));
    const q = rendered(calls[0]);
    expect(q.sql).toContain('"engagements"."deleted_at" is null');
    expect(q.sql).toContain('"engagements"."intern_id" =');
    expect(q.params).toEqual(['i-own', OWN]);
  });

  it('intern without an internId sees nothing and runs no query', async () => {
    expect(await repo.listDocuments({ ...ctx('intern'), internId: undefined })).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('client sees only shared files on its own engagement', async () => {
    await repo.listDocuments(ctx('client'));
    const q = rendered(calls[0]);
    expect(q.sql).toContain('"engagements"."deleted_at" is null');
    expect(q.sql).toContain('"documents"."shared_with_client" =');
    expect(q.sql).toContain('"engagements"."client_user_id" =');
    expect(q.params).toEqual([true, 'user-client', 'c-own']);
  });

  it('client without a clientId never matches on a null client_id', async () => {
    await repo.listDocuments({ ...ctx('client'), clientId: undefined });
    const q = rendered(calls[0]);
    expect(q.sql).not.toContain('"engagements"."client_id"');
    expect(q.params).toEqual([true, 'user-client']);
  });
});

describe('listDocuments (one engagement)', () => {
  it.each(['manager', 'intern', 'client'] as const)(
    '%s gets [] for another firm’s engagement and no file query runs',
    async (role) => {
      assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
      expect(await repo.listDocuments(ctx(role), OTHER)).toEqual([]);
      expect(calls).toHaveLength(0);
    },
  );

  it('client on its own engagement still sees shared files only', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    await repo.listDocuments(ctx('client'), OWN);
    const q = rendered(calls[0]);
    expect(q.sql).toContain('"documents"."shared_with_client" =');
    expect(q.params).toEqual([OWN, true]);
  });
});

describe('getDocumentById', () => {
  it.each(['manager', 'intern', 'client'] as const)(
    '%s gets null for a file on another firm’s engagement',
    async (role) => {
      results = [[docRow(OTHER)]];
      assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
      expect(await repo.getDocumentById(ctx(role), 'doc-1')).toBeNull();
      expect(assertEngagementAccess).toHaveBeenCalledWith(ctx(role), OTHER);
    },
  );

  it('client gets null for an unshared file on its own engagement', async () => {
    results = [[docRow(OWN, { sharedWithClient: false })]];
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { checklistState: {} } });
    expect(await repo.getDocumentById(ctx('client'), 'doc-1')).toBeNull();
  });
});

describe('createDocument', () => {
  it('client may not create index rows', async () => {
    await expect(
      repo.createDocument(ctx('client'), { engagementId: OWN, fileName: 'a.pdf', objectKey: 'k' }),
    ).rejects.toThrow(/clients may not/i);
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'intern'] as const)('%s cannot create on another firm’s engagement', async (role) => {
    getEngagementById.mockResolvedValue(null);
    await expect(
      repo.createDocument(ctx(role), { engagementId: OTHER, fileName: 'a.pdf', objectKey: 'k' }),
    ).rejects.toThrow(/not found or not permitted/i);
    expect(writes()).toHaveLength(0);
  });

  it('an object key already indexed on another firm’s engagement is refused, not returned', async () => {
    getEngagementById.mockResolvedValue({ id: OWN });
    results = [[docRow(OTHER)]];
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
    await expect(
      repo.createDocument(ctx('manager'), { engagementId: OWN, fileName: 'a.pdf', objectKey: 'k' }),
    ).rejects.toThrow(/not found or not permitted/i);
    expect(writes()).toHaveLength(0);
  });

  it('writes against the approved engagement with the session user as uploader', async () => {
    getEngagementById.mockResolvedValue({ id: OWN });
    results = [[], [docRow(OWN)]];
    await repo.createDocument(ctx('manager'), { engagementId: 'e1', fileName: ' a.pdf ', objectKey: ' k ' });
    const insert = calls.find((c) => c.op === 'insert')!;
    const values = insert.values as { engagementId: string; uploadedBy: string; objectKey: string };
    expect(values.engagementId).toBe(OWN);
    expect(values.uploadedBy).toBe('user-manager');
    expect(values.objectKey).toBe('k');
  });
});
