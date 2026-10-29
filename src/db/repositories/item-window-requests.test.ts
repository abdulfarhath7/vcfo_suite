import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { AuthContext } from '@/auth/guards';
import { workDbStub as stub } from '@/db/repositories/work-test-stub';

/**
 * Date-change requests: only a lead asks, on an item they can resolve that has a
 * manager window; a manager decides only on their engagements (approve applies the
 * window through the schedule repository); only the asker withdraws.
 */

vi.mock('@/db/client', async () => ({
  db: (await import('@/db/repositories/work-test-stub')).workDbStub.db,
}));
const resolveWorkItem = vi.fn();
const currentItemWindow = vi.fn();
vi.mock('@/db/repositories/work-items', () => ({
  resolveWorkItem: (...a: unknown[]) => resolveWorkItem(...a),
  currentItemWindow: (...a: unknown[]) => currentItemWindow(...a),
}));
const listScopedEngagementIds = vi.fn();
const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));
const setEngagementWindow = vi.fn();
const setComplianceInstanceWindow = vi.fn();
vi.mock('@/db/repositories/schedule', () => ({
  setEngagementWindow: (...a: unknown[]) => setEngagementWindow(...a),
  setComplianceInstanceWindow: (...a: unknown[]) => setComplianceInstanceWindow(...a),
}));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn() }));

const repo = await import('@/db/repositories/item-window-requests');
const dialect = new PgDialect();

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const KEY = `step:${OWN}:post-1`;

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role, internId: 'i1' };
}
function requestRow(over: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    engagementId: OWN,
    itemKey: KEY,
    requestedBy: 'user-intern',
    fromDate: '2026-10-20',
    toDate: '2026-10-30',
    reason: 'Client travelling',
    status: 'pending',
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: new Date(),
    ...over,
  };
}
const ask = { itemKey: KEY, toDate: '2026-10-30', reason: 'Client travelling' };

beforeEach(() => {
  vi.clearAllMocks();
  stub.reset();
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('listWindowRequests', () => {
  it.each(['client', 'developer'] as const)('%s gets [] and no query', async (role) => {
    expect(await repo.listWindowRequests(ctx(role))).toEqual([]);
    expect(stub.calls).toHaveLength(0);
  });

  it('a manager reads requests on scoped engagements only', async () => {
    stub.queue([]);
    await repo.listWindowRequests(ctx('manager'));
    const q = dialect.sqlToQuery(stub.calls[0]!.where!);
    expect(q.params).toContain(OWN);
    expect(q.params).not.toContain(OTHER);
    expect(q.params).not.toContain('user-manager');
  });

  it('a lead reads only their own requests on scoped engagements', async () => {
    stub.queue([]);
    await repo.listWindowRequests(ctx('intern'));
    const q = dialect.sqlToQuery(stub.calls[0]!.where!);
    expect(q.params).toEqual(expect.arrayContaining([OWN, 'user-intern', 'pending']));
  });

  it('a manager with no engagements gets [] without a request query', async () => {
    listScopedEngagementIds.mockResolvedValue([]);
    expect(await repo.listWindowRequests(ctx('manager'))).toEqual([]);
    expect(stub.calls).toHaveLength(0);
  });

  it.each(['admin', 'super_admin'] as const)('%s reads firm-wide', async (role) => {
    stub.queue([]);
    await repo.listWindowRequests(ctx(role));
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
  });
});

describe('createWindowRequest', () => {
  it.each(['manager', 'admin', 'client'] as const)('%s may not ask', async (role) => {
    await expect(repo.createWindowRequest(ctx(role), ask)).rejects.toThrow('forbidden');
    expect(resolveWorkItem).not.toHaveBeenCalled();
  });

  it('writes nothing for an item outside the lead’s scope', async () => {
    resolveWorkItem.mockResolvedValue(null);
    expect(await repo.createWindowRequest(ctx('intern'), { ...ask, itemKey: `step:${OTHER}:post-1` })).toBeNull();
    expect(stub.writes()).toHaveLength(0);
  });

  it('needs a manager window and refuses a second pending request', async () => {
    resolveWorkItem.mockResolvedValue({ key: KEY, engagementId: OWN });
    currentItemWindow.mockResolvedValue(null);
    await expect(repo.createWindowRequest(ctx('intern'), ask)).rejects.toThrow('invalid_no_window');
    currentItemWindow.mockResolvedValue({ from: '2026-10-20', to: '2026-10-25' });
    stub.queue([{ id: 'w0' }]);
    await expect(repo.createWindowRequest(ctx('intern'), ask)).rejects.toThrow('request_pending');
    expect(stub.writes()).toHaveLength(0);
  });

  it('stores the resolved window for the lead', async () => {
    resolveWorkItem.mockResolvedValue({ key: KEY, engagementId: OWN });
    currentItemWindow.mockResolvedValue({ from: '2026-10-20', to: '2026-10-25' });
    stub.queue([], [requestRow()]);
    await repo.createWindowRequest(ctx('intern'), ask);
    expect(stub.writes()[0]!.values).toMatchObject({
      engagementId: OWN,
      itemKey: KEY,
      requestedBy: 'user-intern',
      fromDate: '2026-10-20',
      toDate: '2026-10-30',
    });
  });
});

describe('decideWindowRequest', () => {
  it('a lead may not decide', async () => {
    await expect(repo.decideWindowRequest(ctx('intern'), 'w1', { action: 'approve' })).rejects.toThrow('forbidden');
    expect(stub.calls).toHaveLength(0);
  });

  it('a manager outside the engagement gets null and nothing is applied', async () => {
    stub.queue([requestRow({ engagementId: OTHER })]);
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
    expect(await repo.decideWindowRequest(ctx('manager'), 'w1', { action: 'approve' })).toBeNull();
    expect(setEngagementWindow).not.toHaveBeenCalled();
    expect(stub.writes()).toHaveLength(0);
  });

  it('approve applies the step window through the schedule repository', async () => {
    stub.queue([requestRow()], [requestRow({ status: 'approved' })]);
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    await repo.decideWindowRequest(ctx('manager'), 'w1', { action: 'approve' });
    expect(setEngagementWindow).toHaveBeenCalledWith(ctx('manager'), OWN, { kind: 'step', itemId: 'post-1' }, {
      from: '2026-10-20',
      to: '2026-10-30',
    });
    expect(stub.writes()[0]!.set).toMatchObject({ status: 'approved', decidedBy: 'user-manager' });
  });

  it('approve on a filing uses the compliance window', async () => {
    const filing = 'filing:33333333-3333-3333-3333-333333333303';
    stub.queue([requestRow({ itemKey: filing })], [requestRow({ status: 'approved' })]);
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    await repo.decideWindowRequest(ctx('admin'), 'w1', { action: 'approve' });
    expect(setComplianceInstanceWindow).toHaveBeenCalledWith(
      ctx('admin'),
      '33333333-3333-3333-3333-333333333303',
      { from: '2026-10-20', to: '2026-10-30' },
    );
  });

  it('reject needs a note and never applies a window', async () => {
    stub.queue([requestRow()]);
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    await expect(repo.decideWindowRequest(ctx('manager'), 'w1', { action: 'reject' })).rejects.toThrow('invalid_note');
    expect(setEngagementWindow).not.toHaveBeenCalled();
    expect(stub.writes()).toHaveLength(0);
  });
});

describe('withdrawWindowRequest', () => {
  it('another lead’s request reads as missing', async () => {
    stub.queue([requestRow({ requestedBy: 'someone-else' })]);
    expect(await repo.withdrawWindowRequest(ctx('intern'), 'w1')).toBeNull();
    expect(stub.writes()).toHaveLength(0);
  });

  it('the asker withdraws a pending request', async () => {
    stub.queue([requestRow()], [requestRow({ status: 'withdrawn' })]);
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    await repo.withdrawWindowRequest(ctx('intern'), 'w1');
    const write = stub.writes()[0]!;
    expect(write.set).toMatchObject({ status: 'withdrawn' });
    expect(dialect.sqlToQuery(write.where!).params).toEqual(['w1', 'user-intern', 'pending']);
  });
});
