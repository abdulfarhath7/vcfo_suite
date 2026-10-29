import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Vault additions to the documents repository (G-26): resolving files for the ZIP, preview and
 * mail-attachment routes, the requests list, and the review state. Every path goes through
 * `assertEngagementAccess` (or `getDocumentById`, which does), so a file on another firm's
 * engagement resolves to nothing, a review of it writes nothing, and a client or developer is
 * refused before the first query where the feature is staff only.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    innerJoin: () => c,
    leftJoin: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
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

const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', async () => {
  const { eq } = await import('drizzle-orm');
  const { engagements } = await import('@/db/schema');
  return {
    assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
    getEngagementById: vi.fn(),
    managerOwnsEngagement: (userId: string) => eq(engagements.managerId, userId),
  };
});
vi.mock('@/db/repositories/engagement-leads-membership', () => ({ listLeadMemberEngagementIds: vi.fn() }));
vi.mock('@/db/repositories/engagement-managers-membership', () => ({ listManagerMemberEngagementIds: vi.fn() }));
const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));
const createNotification = vi.fn();
vi.mock('@/db/repositories/notifications', () => ({
  createNotification: (...a: unknown[]) => createNotification(...a),
}));
vi.mock('@/storage/s3', () => ({ bucketKey: (b: string, p: string) => `${b}/${p.replace(/^\/+/, '')}` }));

const checklistItemForFieldId = vi.fn();
vi.mock('@/lib/documents/vault-documents', () => ({
  checklistItemForFieldId: (...a: unknown[]) => checklistItemForFieldId(...a),
}));
const isStepReleasedTo = vi.fn();
vi.mock('@/lib/checklist/checklist-visibility', () => ({
  checklistViewerForRole: (role: string) => (role === 'intern' ? 'lead' : role === 'client' ? 'client' : 'manager'),
  isStepReleasedTo: (...a: unknown[]) => isStepReleasedTo(...a),
}));

const repo = await import('@/db/repositories/documents');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const DOC = '44444444-4444-4444-4444-444444444404';
const FILE = '55555555-5555-5555-5555-555555555505';
const PATH_OWN = `${OWN}/pan_card/1730000000000-pan.pdf`;
const PATH_OTHER = `${OTHER}/pan_card/1730000000000-pan.pdf`;

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
    id: DOC,
    engagementId,
    category: null,
    fileName: 'coi.pdf',
    objectKey: `engagement-documents/${engagementId}/coi.pdf`,
    contentType: 'application/pdf',
    sizeBytes: 10,
    uploadedBy: 'user-intern',
    stepId: null,
    sharedWithClient: true,
    reviewStatus: 'none',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: new Date(),
    ...overrides,
  };
}

/** Access is granted on OWN only, as for a person on another firm's engagement. */
function grantOwnOnly() {
  assertEngagementAccess.mockImplementation(async (_ctx: unknown, id: string) =>
    id === OWN
      ? { ok: true, dbId: OWN, row: { id: OWN, checklistState: {} } }
      : { ok: false, dbId: id, forbidden: true },
  );
}

const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  grantOwnOnly();
  checklistItemForFieldId.mockReturnValue(undefined);
  isStepReleasedTo.mockReturnValue(true);
});

describe('documentStorageKey', () => {
  it('keeps a prefixed key and prefixes a bare one', () => {
    expect(repo.documentStorageKey('engagement-documents/a/b.pdf')).toBe('engagement-documents/a/b.pdf');
    expect(repo.documentStorageKey('milestone-documents/a/f/1-b.pdf')).toBe('milestone-documents/a/f/1-b.pdf');
    expect(repo.documentStorageKey('a/f/1730000000000-b.pdf')).toBe('milestone-documents/a/f/1730000000000-b.pdf');
    expect(repo.documentStorageKey('/a/b.pdf')).toBe('engagement-documents/a/b.pdf');
  });
});

describe('resolveVaultFiles', () => {
  it.each(['admin', 'manager', 'intern', 'client'] as const)(
    '%s gets nothing for an indexed document on another engagement',
    async (role) => {
      results = [[docRow(OTHER)]];
      expect(await repo.resolveVaultFiles(ctx(role), [{ documentId: DOC }])).toEqual([]);
      expect(assertEngagementAccess).toHaveBeenCalledWith(ctx(role), OTHER);
    },
  );

  it('resolves an own indexed document with its storage key and folder', async () => {
    results = [[docRow(OWN)]];
    const [file] = await repo.resolveVaultFiles(ctx('manager'), [{ documentId: DOC, folder: 'Pre' }]);
    expect(file).toMatchObject({
      kind: 'document',
      engagementId: OWN,
      storageKey: `engagement-documents/${OWN}/coi.pdf`,
      folder: 'Pre',
    });
  });

  it.each(['admin', 'manager', 'intern', 'client'] as const)(
    '%s gets nothing for a checklist upload on another engagement',
    async (role) => {
      expect(await repo.resolveVaultFiles(ctx(role), [{ path: PATH_OTHER }])).toEqual([]);
      expect(assertEngagementAccess).toHaveBeenCalledWith(ctx(role), OTHER);
    },
  );

  it('refuses a path with dot segments without asking for access', async () => {
    expect(await repo.resolveVaultFiles(ctx('admin'), [{ path: `${OWN}/../${OTHER}/1730000000000-x.pdf` }])).toEqual([]);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });

  it('hides a checklist upload whose step is not released to a manager', async () => {
    checklistItemForFieldId.mockReturnValue({ id: 'pre-1' });
    isStepReleasedTo.mockReturnValue(false);
    expect(await repo.resolveVaultFiles(ctx('manager'), [{ path: PATH_OWN }])).toEqual([]);
  });

  it('lets the lead read a checklist upload before release', async () => {
    checklistItemForFieldId.mockReturnValue({ id: 'pre-1' });
    isStepReleasedTo.mockReturnValue(false);
    const [file] = await repo.resolveVaultFiles(ctx('intern'), [{ path: PATH_OWN }]);
    expect(file).toMatchObject({ kind: 'milestone', fileName: 'pan.pdf', storageKey: `milestone-documents/${PATH_OWN}` });
  });

  it('gets nothing for a request file on another engagement', async () => {
    results = [[{ id: FILE, engagementId: OTHER, objectKey: 'k', fileName: 'x.pdf', contentType: null, sizeBytes: 1, uploadedAt: new Date() }]];
    expect(await repo.resolveVaultFiles(ctx('manager'), [{ requestFileId: FILE }])).toEqual([]);
  });

  it('asks for each engagement once in a batch', async () => {
    await repo.resolveVaultFiles(ctx('admin'), [{ path: PATH_OWN }, { path: `${OWN}/gst/1730000000001-gst.pdf` }]);
    expect(assertEngagementAccess).toHaveBeenCalledTimes(1);
  });

  it('gives a developer nothing without a query', async () => {
    expect(await repo.resolveVaultFiles(ctx('developer'), [{ documentId: DOC }, { path: PATH_OWN }])).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });
});

describe('listVaultRequests', () => {
  it.each(['client', 'developer'] as const)('%s gets [] before any query', async (role) => {
    expect(await repo.listVaultRequests(ctx(role), OWN)).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });

  it.each(['admin', 'manager', 'intern'] as const)('%s gets [] for another engagement and no request query', async (role) => {
    expect(await repo.listVaultRequests(ctx(role), OTHER)).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('reads only the approved engagement and joins the files', async () => {
    const req = { id: 'r1', engagementId: OWN, title: 'PAN card', detail: null, status: 'fulfilled', createdAt: new Date() };
    results = [
      [{ req, det: { dueOn: '2026-11-01', stepId: 'pre-1' } }],
      [{ id: FILE, requestId: 'r1', engagementId: OWN, fileName: 'pan.pdf', contentType: 'application/pdf', sizeBytes: 3, uploadedAt: new Date() }],
      [docRow(OWN, { id: DOC, objectKey: `engagement-documents/${OWN}/requests/r1/1-pan2.pdf`, fileName: 'pan2.pdf' })],
    ];
    const list = await repo.listVaultRequests(ctx('manager'), OWN);
    expect(list).toHaveLength(1);
    expect(list[0]!.dueOn).toBe('2026-11-01');
    expect(list[0]!.files.map((f) => `${f.kind}:${f.fileName}`)).toEqual(['request-file:pan.pdf', 'document:pan2.pdf']);
    for (const call of calls) {
      const q = dialect.sqlToQuery(call.where!);
      expect(q.params).toContain(OWN);
      expect(q.params).not.toContain(OTHER);
    }
  });
});

describe('setDocumentReview', () => {
  it.each(['client', 'developer'] as const)('%s is refused before any query', async (role) => {
    await expect(
      repo.setDocumentReview(ctx(role), { ref: { documentId: DOC }, status: 'approved' }),
    ).rejects.toThrow('not permitted');
    expect(calls).toHaveLength(0);
  });

  it('needs a note to ask for changes', async () => {
    await expect(
      repo.setDocumentReview(ctx('manager'), { ref: { documentId: DOC }, status: 'changes', note: ' ' }),
    ).rejects.toThrow('review_note_required');
    expect(calls).toHaveLength(0);
  });

  it.each(['admin', 'manager', 'intern'] as const)('%s writes nothing for a file on another engagement', async (role) => {
    results = [[docRow(OTHER)]];
    expect(await repo.setDocumentReview(ctx(role), { ref: { documentId: DOC }, status: 'approved' })).toBeNull();
    expect(writes()).toHaveLength(0);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('writes nothing for a checklist upload on another engagement', async () => {
    expect(await repo.setDocumentReview(ctx('admin'), { ref: { path: PATH_OTHER }, status: 'approved' })).toBeNull();
    expect(writes()).toHaveLength(0);
  });

  it('records the review, an audit event and a note for the uploader', async () => {
    const reviewed = docRow(OWN, { reviewStatus: 'changes', reviewNote: 'Older than 2 months', reviewedBy: 'user-manager' });
    results = [[docRow(OWN)], [docRow(OWN)], [reviewed], [{ role: 'intern' }], [{ companyName: 'Acme' }]];
    const dto = await repo.setDocumentReview(ctx('manager'), {
      ref: { documentId: DOC },
      status: 'changes',
      note: 'Older than 2 months',
    });
    expect(dto?.reviewStatus).toBe('changes');
    const update = calls.find((c) => c.op === 'update')!;
    expect(update.set).toMatchObject({ reviewStatus: 'changes', reviewedBy: 'user-manager', reviewNote: 'Older than 2 months' });
    expect(dialect.sqlToQuery(update.where!).params).toEqual([DOC, OWN]);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      ctx('manager'),
      expect.objectContaining({ engagementId: OWN, action: 'document.review' }),
    );
    expect(createNotification).toHaveBeenCalledWith(
      ctx('manager'),
      expect.objectContaining({ userId: 'user-intern', href: '/app/intern/vault' }),
    );
  });

  it('gives a checklist upload an index row with no uploader before reviewing it', async () => {
    results = [[], [docRow(OWN, { objectKey: PATH_OWN, uploadedBy: null })], [docRow(OWN, { reviewStatus: 'approved', uploadedBy: null })]];
    await repo.setDocumentReview(ctx('intern'), { ref: { path: PATH_OWN }, status: 'approved' });
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.values).toMatchObject({ engagementId: OWN, objectKey: PATH_OWN, fileName: 'pan.pdf' });
    expect((insert.values as Record<string, unknown>).uploadedBy).toBeUndefined();
    expect(createNotification).not.toHaveBeenCalled();
  });
});
