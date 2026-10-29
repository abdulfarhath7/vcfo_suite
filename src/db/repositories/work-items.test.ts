import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { workDbStub as stub } from '@/db/repositories/work-test-stub';

/**
 * Cross-tenant scoping for work items: a key resolves only through an engagement the
 * caller can access (`assertEngagementAccess`), clients and developers get nothing
 * before any query, and a foreign item's files, activity and request-file links never
 * load.
 */

// Filing events are written fire-and-forget after the action; they are tested in filing-events.test.ts.
vi.mock('@/db/repositories/filing-events', () => ({ recordFilingEvent: async () => undefined, windowEventLabel: () => '' }));
vi.mock('@/db/client', async () => ({
  db: (await import('@/db/repositories/work-test-stub')).workDbStub.db,
}));

const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  checklistStateFromRow: () => ({}),
  toAppEngagement: () => ({}),
}));
const listDocuments = vi.fn();
vi.mock('@/db/repositories/documents', () => ({ listDocuments: (...a: unknown[]) => listDocuments(...a) }));
const listFilingProofs = vi.fn();
vi.mock('@/db/repositories/client-compliances', () => ({
  listFilingProofs: (...a: unknown[]) => listFilingProofs(...a),
}));
const listAuditEvents = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({ listAuditEvents: (...a: unknown[]) => listAuditEvents(...a) }));
const signedDownloadUrl = vi.fn();
vi.mock('@/storage/s3', () => ({ signedDownloadUrl: (...a: unknown[]) => signedDownloadUrl(...a) }));

const repo = await import('@/db/repositories/work-items');

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const FILING = '33333333-3333-3333-3333-333333333303';
const FILE = '44444444-4444-4444-4444-444444444404';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role, internId: 'intern-1' };
}
const denied = { ok: false, dbId: OTHER, forbidden: true };
const allowed = (dbId = OWN) => ({ ok: true, dbId, row: { id: dbId, schedule: {}, checklistState: {} } });

beforeEach(() => {
  vi.clearAllMocks();
  stub.reset();
  listAuditEvents.mockResolvedValue([]);
  listDocuments.mockResolvedValue([]);
  listFilingProofs.mockResolvedValue([]);
});

describe('resolveWorkItem', () => {
  it.each(['client', 'developer'] as const)('%s gets null before any query', async (role) => {
    expect(await repo.resolveWorkItem(ctx(role), `step:${OWN}:pre-1`)).toBeNull();
    expect(stub.calls).toHaveLength(0);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });

  it.each(['intern', 'manager'] as const)('%s gets null for a step on another firm’s engagement', async (role) => {
    assertEngagementAccess.mockResolvedValue(denied);
    expect(await repo.resolveWorkItem(ctx(role), `step:${OTHER}:pre-1`)).toBeNull();
    expect(assertEngagementAccess).toHaveBeenCalledWith(ctx(role), OTHER);
  });

  it.each(['intern', 'manager', 'admin', 'super_admin'] as const)(
    '%s gets null for a filing whose engagement is out of scope',
    async (role) => {
      stub.queue([{ engagementId: OTHER }]);
      assertEngagementAccess.mockResolvedValue(role === 'admin' || role === 'super_admin' ? allowed(OTHER) : denied);
      const out = await repo.resolveWorkItem(ctx(role), `filing:${FILING}`);
      if (role === 'admin' || role === 'super_admin') expect(out?.engagementId).toBe(OTHER);
      else expect(out).toBeNull();
    },
  );

  it('normalizes a legacy demo id in a step key to the database id', async () => {
    assertEngagementAccess.mockResolvedValue(allowed(OWN));
    const out = await repo.resolveWorkItem(ctx('intern'), 'step:e1:pre-1');
    expect(out?.key).toBe(`step:${OWN}:pre-1`);
  });

  it('refuses malformed keys and unknown steps without a query', async () => {
    expect(await repo.resolveWorkItem(ctx('admin'), 'filing:not-a-uuid')).toBeNull();
    expect(await repo.resolveWorkItem(ctx('admin'), `step:${OWN}:no-such-step`)).toBeNull();
    expect(await repo.resolveWorkItem(ctx('admin'), 'junk')).toBeNull();
    expect(stub.calls).toHaveLength(0);
  });

  it('gives null for a filing that does not exist', async () => {
    stub.queue([]);
    expect(await repo.resolveWorkItem(ctx('admin'), `filing:${FILING}`)).toBeNull();
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });
});

describe('getWorkItemDetail', () => {
  it('loads nothing for a foreign item', async () => {
    assertEngagementAccess.mockResolvedValue(denied);
    expect(await repo.getWorkItemDetail(ctx('intern'), `step:${OTHER}:pre-1`)).toBeNull();
    expect(listDocuments).not.toHaveBeenCalled();
    expect(listAuditEvents).not.toHaveBeenCalled();
  });

  it('returns only the step’s own files and the item’s activity', async () => {
    assertEngagementAccess.mockResolvedValue(allowed());
    listDocuments.mockResolvedValue([
      { id: 'd1', stepId: 'pre-1', fileName: 'pan.pdf', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 'd2', stepId: 'pre-3', fileName: 'other.pdf', createdAt: '2026-10-01T00:00:00.000Z' },
    ]);
    listAuditEvents.mockResolvedValue([
      { id: 'a1', created_at: '2026-10-02T00:00:00.000Z', actor_name: 'Lead', metadata: { itemId: 'pre-1' }, summary: 'Saved' },
      { id: 'a2', created_at: '2026-10-02T00:00:00.000Z', actor_name: 'Lead', metadata: { itemId: 'pre-3' }, summary: 'Other' },
    ]);
    stub.queue([]); // activity rows
    const detail = await repo.getWorkItemDetail(ctx('intern'), `step:${OWN}:pre-1`);
    expect(listDocuments).toHaveBeenCalledWith(ctx('intern'), OWN);
    expect(listAuditEvents).toHaveBeenCalledWith(ctx('intern'), expect.objectContaining({ engagementId: OWN }));
    expect(detail?.files.map((f) => f.id)).toEqual(['d1']);
    expect(detail?.activity.map((a) => a.id)).toEqual(['audit:a1']);
    expect(detail?.completion.mode).toBe('direct');
  });
});

describe('getRequestFileUrl', () => {
  it('signs nothing when the request is on a foreign engagement', async () => {
    stub.queue(
      [{ requestId: '55555555-5555-5555-5555-555555555505', engagementId: OTHER, objectKey: 'k', fileName: 'a.pdf' }],
      [{ engagementId: OTHER }],
    );
    assertEngagementAccess.mockResolvedValue(denied);
    expect(await repo.getRequestFileUrl(ctx('manager'), FILE)).toBeNull();
    expect(signedDownloadUrl).not.toHaveBeenCalled();
  });

  it('refuses a client before any query', async () => {
    expect(await repo.getRequestFileUrl(ctx('client'), FILE)).toBeNull();
    expect(stub.calls).toHaveLength(0);
  });

  it('signs a file on an accessible request', async () => {
    stub.queue(
      [{ requestId: '55555555-5555-5555-5555-555555555505', engagementId: OWN, objectKey: 'k', fileName: 'a.pdf' }],
      [{ engagementId: OWN }],
    );
    assertEngagementAccess.mockResolvedValue(allowed());
    signedDownloadUrl.mockResolvedValue('https://signed');
    expect(await repo.getRequestFileUrl(ctx('intern'), FILE)).toEqual({ url: 'https://signed', fileName: 'a.pdf' });
  });
});
