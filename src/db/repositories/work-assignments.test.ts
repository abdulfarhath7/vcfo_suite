import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';

/**
 * Work assignments (G-12, G-18): super_admin, admin and manager only, on an engagement in
 * scope, to a lead who is on that engagement. A foreign engagement or a lead from elsewhere
 * makes no write.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    innerJoin: () => c,
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
const patchChecklistItem = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  patchChecklistItem: (...a: unknown[]) => patchChecklistItem(...a),
  listScopedEngagementIds: vi.fn(),
  listEngagements: vi.fn(),
}));
const addEngagementLead = vi.fn();
const replaceEngagementLead = vi.fn();
vi.mock('@/db/repositories/engagement-leads', () => ({
  addEngagementLead: (...a: unknown[]) => addEngagementLead(...a),
  replaceEngagementLead: (...a: unknown[]) => replaceEngagementLead(...a),
}));

const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));

const repo = await import('@/db/repositories/work-assignments');

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const LEAD = '44444444-4444-4444-8444-444444444404';
const TASK = '55555555-5555-4555-8555-555555555505';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role, internId: role === 'intern' ? 'i1' : undefined };
}

const allowed = { ok: true, dbId: OWN, row: { companyName: 'Acme', internId: 'i1' } };
const denied = { ok: false, dbId: OTHER, forbidden: true };
const leadRow = (internId = 'i2') => ({ id: LEAD, internId, name: 'Asha', email: 'asha@x.in', status: 'active' });
const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('assignLeadTask', () => {
  it.each(['intern', 'client', 'developer'] as const)('%s may not assign', async (role) => {
    await expect(
      repo.assignLeadTask(ctx(role), { engagementId: OWN, leadId: 'i2', title: 'Call bank' }),
    ).rejects.toThrow(/not permitted/i);
    expect(calls).toHaveLength(0);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });

  it('a manager cannot assign on another firm’s engagement', async () => {
    assertEngagementAccess.mockResolvedValue(denied);
    await expect(
      repo.assignLeadTask(ctx('manager'), { engagementId: OTHER, leadId: 'i2', title: 'Call bank' }),
    ).rejects.toThrow(/not found or not permitted/i);
    expect(writes()).toHaveLength(0);
  });

  it('refuses a lead who is not on the engagement', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [[leadRow('i9')], [{ internId: 'i2' }]];
    await expect(
      repo.assignLeadTask(ctx('manager'), { engagementId: OWN, leadId: 'i9', title: 'Call bank' }),
    ).rejects.toThrow(/not on this engagement/i);
    expect(writes()).toHaveLength(0);
  });

  it.each(['manager', 'admin', 'super_admin'] as const)('%s writes the task against the approved engagement', async (role) => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [
      [leadRow('i2')],
      [{ internId: 'i2' }],
      [{ id: TASK, engagementId: OWN, assignedTo: LEAD, title: 'Call bank', description: null, stepId: null, deadline: null, status: 'open', updatedAt: new Date() }],
    ];
    const out = await repo.assignLeadTask(ctx(role), { engagementId: 'e1', leadId: 'i2', title: ' Call bank ' });
    const insert = writes()[0]!;
    expect(insert.values).toMatchObject({ engagementId: OWN, assignedTo: LEAD, title: 'Call bank', stepId: null });
    expect(out.task.title).toBe('Call bank');
    expect(out.lead.profileId).toBe(LEAD);
  });
});

describe('reassignWork', () => {
  it.each(['intern', 'client'] as const)('%s may not reassign', async (role) => {
    await expect(
      repo.reassignWork(ctx(role), { kind: 'lead', engagementId: OWN, fromLeadId: 'i1', toLeadId: 'i2' }),
    ).rejects.toThrow(/not permitted/i);
    expect(calls).toHaveLength(0);
  });

  it('a manager cannot reassign on another firm’s engagement', async () => {
    assertEngagementAccess.mockResolvedValue(denied);
    await expect(
      repo.reassignWork(ctx('manager'), { kind: 'item', engagementId: OTHER, itemKey: `task:${TASK}`, toLeadId: 'i2' }),
    ).rejects.toThrow(/not found or not permitted/i);
    expect(writes()).toHaveLength(0);
    expect(replaceEngagementLead).not.toHaveBeenCalled();
  });

  it('a task from another engagement is not found and nothing is written', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [[leadRow('i2')], []];
    await expect(
      repo.reassignWork(ctx('admin'), { kind: 'item', engagementId: OWN, itemKey: `task:${TASK}`, toLeadId: 'i2' }),
    ).rejects.toThrow(/task not found/i);
    expect(writes()).toHaveLength(0);
  });

  it('moves a task to a lead on the engagement', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [[leadRow('i2')], [{ id: TASK, title: 'Call bank' }], [{ internId: 'i2' }], []];
    const out = await repo.reassignWork(ctx('manager'), { kind: 'item', engagementId: OWN, itemKey: `task:${TASK}`, toLeadId: 'i2' });
    expect(writes()[0]!.set).toMatchObject({ assignedTo: LEAD });
    expect(out.kind).toBe('task');
  });

  it('a step joins the new lead to the engagement, then sets the step owner', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [[leadRow('i2')]];
    const out = await repo.reassignWork(ctx('super_admin'), {
      kind: 'item',
      engagementId: OWN,
      itemKey: `step:${OWN}:pre-1`,
      toLeadId: 'i2',
    });
    expect(addEngagementLead).toHaveBeenCalledWith(ctx('super_admin'), OWN, 'i2');
    expect(patchChecklistItem).toHaveBeenCalledWith(ctx('super_admin'), appEngagementId(OWN), 'pre-1', { assigneeId: 'i2' });
    expect(out.kind).toBe('step');
  });

  it('a whole client moves through replaceEngagementLead', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [[leadRow('i2')], [leadRow('i1')], [{ internId: 'i1' }]];
    await repo.reassignWork(ctx('admin'), { kind: 'lead', engagementId: OWN, fromLeadId: 'i1', toLeadId: 'i2' });
    expect(replaceEngagementLead).toHaveBeenCalledWith(ctx('admin'), OWN, 'i1', 'i2');
  });

  it('refuses a filing key', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [[leadRow('i2')]];
    await expect(
      repo.reassignWork(ctx('admin'), { kind: 'item', engagementId: OWN, itemKey: `filing:${TASK}`, toLeadId: 'i2' }),
    ).rejects.toThrow(/only steps, tasks/i);
    expect(writes()).toHaveLength(0);
  });
});

describe('removeLead', () => {
  const FROM = { id: LEAD, internId: 'i1', name: 'Asha', email: 'asha@x', status: 'active' };
  const TO = { id: '66666666-6666-4666-8666-666666666606', internId: 'i2', name: 'Bala', email: 'bala@x', status: 'active' };

  it.each(['intern', 'client'] as const)('%s is refused and nothing is read or written', async (role) => {
    await expect(repo.removeLead(ctx(role), { fromLeadId: 'i1', toLeadId: 'i2' })).rejects.toThrow(/not permitted/i);
    expect(calls).toHaveLength(0);
  });

  it('a manager moves only the clients they manage; another firm’s client is untouched', async () => {
    // findLead from, findLead to, primary engagements, co-lead engagements, then the task update.
    results = [[FROM], [TO], [{ id: OWN }, { id: OTHER }], [], [{ id: TASK }]];
    assertEngagementAccess.mockImplementation(async (_c: unknown, id: string) =>
      id === OWN ? { ...allowed, row: { ...allowed.row, checklistState: { 'pre-2': { assigneeId: 'i1' }, 'pre-3': { assigneeId: 'i9' } } } } : denied,
    );
    const out = await repo.removeLead(ctx('manager'), { fromLeadId: 'i1', toLeadId: 'i2' });
    expect(out.clients).toHaveLength(1);
    expect(out.steps).toBe(1);
    expect(out.tasks).toBe(1);
    expect(patchChecklistItem).toHaveBeenCalledWith(expect.anything(), appEngagementId(OWN), 'pre-2', { assigneeId: 'i2' });
    expect(replaceEngagementLead).toHaveBeenCalledTimes(1);
    expect(replaceEngagementLead).toHaveBeenCalledWith(expect.anything(), OWN, 'i1', 'i2');
    const update = calls.find((c) => c.op === 'update')!;
    expect((update.set as { assignedBy: string }).assignedBy).toBe('user-manager');
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(1);
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
  });

  it('a lead on none of the caller’s clients is a 404 and nothing is written', async () => {
    results = [[FROM], [TO], [{ id: OTHER }], []];
    assertEngagementAccess.mockResolvedValue(denied);
    await expect(repo.removeLead(ctx('manager'), { fromLeadId: 'i1', toLeadId: 'i2' })).rejects.toThrow(/none of your clients/);
    expect(calls.filter((c) => c.op !== 'select')).toHaveLength(0);
    expect(replaceEngagementLead).not.toHaveBeenCalled();
  });

  it('the same lead on both sides is refused', async () => {
    results = [[FROM], [FROM]];
    await expect(repo.removeLead(ctx('admin'), { fromLeadId: 'i1', toLeadId: 'i1' })).rejects.toThrow(/another/);
  });
});
