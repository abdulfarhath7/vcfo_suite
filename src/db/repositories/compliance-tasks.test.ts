import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for the statutory and non-statutory Compliances repositories
 * (docs/ui-port/COMPLIANCE-API.md): tasks, the statutory detail and workflow, the reminder
 * schedule and the counts. A foreign engagement reads as not found and writes nothing; a client
 * never sees a firm-only task; leads and clients cannot create, edit or approve; a developer
 * gets nothing before any query.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];
function chain(call: Call): unknown {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'leftJoin', 'innerJoin', 'orderBy', 'limit', 'returning', 'onConflictDoNothing', 'onConflictDoUpdate']) c[m] = () => c;
  c.where = (w: SQL) => {
    call.where = w;
    return c;
  };
  c.values = (v: unknown) => {
    call.values = v;
    return c;
  };
  c.set = (v: unknown) => {
    call.set = v;
    return c;
  };
  c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej);
  return c;
}
const op = (name: string) => () => {
  const call: Call = { op: name };
  calls.push(call);
  return chain(call);
};
const db = {
  select: op('select'),
  selectDistinct: op('select'),
  insert: op('insert'),
  update: op('update'),
  delete: op('delete'),
  transaction: async (fn: (tx: unknown) => unknown) => fn(db),
};
vi.mock('@/db/client', () => ({ db }));
vi.mock('server-only', () => ({}));
vi.mock('@/storage/s3', () => ({ bucketKey: (b: string, p: string) => `${b}/${p}`, putObject: vi.fn(), deleteObject: vi.fn(), signedDownloadUrl: vi.fn(), getObjectBuffer: vi.fn() }));

const assertEngagementAccess = vi.fn();
const listScopedEngagementIds = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
  getMyEngagement: vi.fn(),
}));
const createNotificationsForUsers = vi.fn(async () => []);
vi.mock('@/db/repositories/notifications', () => ({ createNotificationsForUsers: (...a: unknown[]) => createNotificationsForUsers(...(a as [])) }));
vi.mock('@/db/repositories/compliance-activities', () => ({
  systemEnsureActivitiesSeeded: vi.fn(async () => ({ activities: 0, links: 0 })),
  systemActivityMap: vi.fn(async () => new Map()),
  getActivityRow: vi.fn(async () => null),
  confirmPending: () => false,
  toActivityDto: vi.fn(),
  ActivityError: class extends Error {},
}));
vi.mock('@/lib/compliance-tasks/events', () => ({ queueTaskCompleted: vi.fn() }));

const tasks = await import('@/db/repositories/compliance-tasks');
const statutory = await import('@/db/repositories/compliance-statutory');
const schedule = await import('@/db/repositories/compliance-reminder-schedule');
const counts = await import('@/db/repositories/compliance-counts');
const dialect = new PgDialect();

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const TASK = '33333333-3333-3333-3333-333333333303';
const INSTANCE = '44444444-4444-4444-4444-444444444404';
const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role });
const paramsOf = (c: Call) => (c.where ? dialect.sqlToQuery(c.where).params : []);
const engRow = (over: Record<string, unknown> = {}) => ({ id: OWN, companyName: 'Acme', internId: null, managerId: null, adminId: null, clientUserId: null, ...over });
const taskRow = (over: Record<string, unknown> = {}) => ({
  id: TASK,
  engagementId: OWN,
  activityId: null,
  name: 'Receivables update',
  periodLabel: null,
  startDate: '2026-10-26',
  dueDate: '2026-11-02',
  urgency: 'Low',
  visibility: 'both',
  ownerId: null,
  reviewerId: null,
  stage: 'in-progress',
  repeats: 'one-time',
  remindBefore: 2,
  seriesId: null,
  previousId: null,
  reviewNote: null,
  submittedAt: null,
  completedAt: null,
  approvedBy: null,
  createdBy: null,
  createdAt: new Date('2026-10-25T00:00:00Z'),
  updatedAt: new Date('2026-10-25T00:00:00Z'),
  ...over,
});
const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('non-statutory tasks', () => {
  it('gives a developer nothing before any query', async () => {
    expect(await tasks.listTasks(ctx('developer'), {})).toEqual({ tasks: [], today: expect.any(String) });
    await expect(tasks.getTask(ctx('developer'), TASK)).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(0);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
  });

  it('reads a task of a foreign engagement as not found', async () => {
    results = [[taskRow({ engagementId: OTHER })]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: OTHER, forbidden: true });
    await expect(tasks.getTask(ctx('manager'), TASK)).rejects.toMatchObject({ status: 404, code: 'not_found' });
    expect(assertEngagementAccess).toHaveBeenCalledWith(expect.objectContaining({ role: 'manager' }), OTHER);
    expect(writes()).toHaveLength(0);
  });

  it('hides a firm-only task from the client of the same engagement (K-1)', async () => {
    results = [[taskRow({ visibility: 'firm' })]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: engRow() });
    await expect(tasks.getTask(ctx('client'), TASK)).rejects.toMatchObject({ status: 404 });
  });

  it('limits the client list to its own engagement and client-visible tasks', async () => {
    listScopedEngagementIds.mockResolvedValueOnce([OWN]);
    results = [[]];
    await tasks.listTasks(ctx('client'), { visibility: ['firm'] });
    const params = paramsOf(calls[0]!);
    expect(params).toContain(OWN);
    expect(params).toContain('client');
    expect(params).toContain('both');
    expect(params).not.toContain('firm');
  });

  it('narrows to an asked engagement only when it is in scope', async () => {
    listScopedEngagementIds.mockResolvedValueOnce([OWN]);
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: OTHER, forbidden: true });
    expect((await tasks.listTasks(ctx('intern'), { engagementId: OTHER })).tasks).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('refuses New task to leads and clients before any query (S-4, K-2)', async () => {
    const input = { engagementId: OWN, activityId: null, name: 'X', startDate: '2026-11-01', dueDate: '2026-11-05', urgency: 'Low' as const, visibility: 'both' as const };
    await expect(tasks.createTask(ctx('intern'), input)).rejects.toMatchObject({ status: 403 });
    await expect(tasks.createTask(ctx('client'), input)).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });

  it('creates nothing for a manager on a foreign engagement', async () => {
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: OTHER, forbidden: true });
    await expect(
      tasks.createTask(ctx('manager'), { engagementId: OTHER, activityId: null, name: 'X', startDate: '2026-11-01', dueDate: '2026-11-05', urgency: 'Low', visibility: 'both' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(writes()).toHaveLength(0);
  });

  it('writes a new task against the approved engagement id', async () => {
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: engRow() });
    results = [[], [taskRow({ stage: 'not-started' })]];
    await tasks
      .createTask(ctx('manager'), { engagementId: 'e1', activityId: null, name: 'Bank papers', startDate: '2026-11-01', dueDate: '2026-11-05', urgency: 'High', visibility: 'both' })
      .catch(() => undefined);
    const insert = calls.find((c) => c.op === 'insert');
    expect(insert?.values).toMatchObject({ engagementId: OWN, name: 'Bank papers', urgency: 'High', createdBy: 'user-manager' });
  });

  it('keeps Completed and Not applicable for managers: a lead cannot approve its own task', async () => {
    results = [[taskRow({ stage: 'review' })]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: engRow() });
    await expect(tasks.changeTaskStage(ctx('intern'), TASK, 'completed')).rejects.toMatchObject({ status: 403 });
    results = [[taskRow({ stage: 'review' })]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: engRow() });
    await expect(tasks.reviewTask(ctx('intern'), TASK, { decision: 'approve' })).rejects.toMatchObject({ status: 403 });
    expect(writes()).toHaveLength(0);
  });

  it('refuses client stage changes before any query', async () => {
    await expect(tasks.changeTaskStage(ctx('client'), TASK, 'review')).rejects.toMatchObject({ status: 403 });
    await expect(tasks.addChecklistItem(ctx('client'), TASK, 'x')).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });

  it('never stores a client comment as internal', async () => {
    results = [[taskRow()], [{ id: 'c1', createdAt: new Date() }]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: engRow() });
    const comment = await tasks.addTaskComment(ctx('client'), TASK, { body: 'Shared the file', internal: true });
    expect(comment.internal).toBe(false);
    expect(calls.find((c) => c.op === 'insert')?.values).toMatchObject({ internal: false, authorId: 'user-client' });
  });
});

describe('statutory detail and workflow', () => {
  it('reads an instance of a foreign engagement as not found', async () => {
    results = [[{ inst: { id: INSTANCE, engagementId: OTHER }, obligation: { id: 'gst-gstr-3b' } }]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: OTHER, forbidden: true });
    await expect(statutory.getStatutoryDetail(ctx('intern'), INSTANCE)).rejects.toMatchObject({ status: 404 });
    expect(writes()).toHaveLength(0);
  });

  it('refuses client and developer workflow writes before any query', async () => {
    await expect(statutory.updateStatutory(ctx('client'), INSTANCE, { action: 'submit' })).rejects.toMatchObject({ status: 403 });
    await expect(statutory.updateStatutory(ctx('developer'), INSTANCE, { action: 'submit' })).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(0);
  });

  it('refuses a lead approving an item it is not the reviewer of', async () => {
    results = [[{ inst: { id: INSTANCE, engagementId: OWN, status: 'in-progress', filedOn: null }, obligation: { id: 'gst-gstr-3b', particular: 'GSTR-3B' } }], [{ stage: 'review', reviewerId: 'someone-else' }]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: engRow() });
    await expect(statutory.updateStatutory(ctx('intern'), INSTANCE, { action: 'approve' })).rejects.toMatchObject({ status: 403 });
    expect(writes()).toHaveLength(0);
  });
});

describe('reminder schedule and counts', () => {
  it('lets only admin, super admin and manager change reminders', async () => {
    await expect(schedule.setReminderSchedule(ctx('intern'), { kind: 'task', id: TASK, notifyDays: 3 })).rejects.toMatchObject({ status: 403 });
    await expect(schedule.setReminderSchedule(ctx('client'), { kind: 'statutory', id: INSTANCE, reset: true })).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });

  it('writes no override for a task of a foreign engagement', async () => {
    results = [[taskRow({ engagementId: OTHER })]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: OTHER, forbidden: true });
    await expect(schedule.setReminderSchedule(ctx('manager'), { kind: 'task', id: TASK, rows: [{ key: 'initial', offsetDays: -3 }] })).rejects.toMatchObject({ status: 404 });
    expect(writes()).toHaveLength(0);
  });

  it('counts nothing for a developer or an out-of-scope engagement', async () => {
    const dev = await counts.getComplianceCounts(ctx('developer'));
    expect(dev.all.total).toBe(0);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    listScopedEngagementIds.mockResolvedValueOnce([OWN]);
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: OTHER, forbidden: true });
    const foreign = await counts.getComplianceCounts(ctx('client'), { engagementId: OTHER });
    expect(foreign.statutory.total + foreign.nonStatutory.total).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
