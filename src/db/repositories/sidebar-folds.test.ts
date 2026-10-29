import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * sidebar-folds: the staff sidebar's people lists.
 *   - client and developer get nothing, and no query runs.
 *   - a manager's lead counts read tasks only on the manager's own engagements (cross-tenant:
 *     another manager's engagement never adds to a count), and only leads who report to them.
 *   - a lead reads only their own reports-to line.
 */

type Where = { op: string; args: unknown[] };
type Call = { op: string; where?: Where };
const calls: Call[] = [];
let results: unknown[][] = [];

vi.mock('drizzle-orm', () => {
  const mk =
    (op: string) =>
    (...args: unknown[]): Where => ({ op, args });
  return { and: mk('and'), asc: mk('asc'), eq: mk('eq'), inArray: mk('inArray'), isNull: mk('isNull'), ne: mk('ne') };
});

vi.mock('@/db/schema', () => {
  const col = (t: string) => new Proxy({}, { get: (_o, k) => `${t}.${String(k)}` });
  return { engagements: col('engagements'), profiles: col('profiles'), tasks: col('tasks') };
});

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    where: (w: Where) => {
      call.where = w;
      return c;
    },
    orderBy: () => c,
    limit: () => c,
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const call: Call = { op: 'select' };
      calls.push(call);
      return chain(call);
    },
  },
}));

const scoped = vi.fn<(ctx: AuthContext) => Promise<string[]>>();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (ctx: AuthContext) => scoped(ctx),
}));

const repo = await import('@/db/repositories/sidebar-folds');

function ctx(role: AuthContext['role'], userId = `user-${role}`): AuthContext {
  return { userId, email: `${role}@vcfo.local`, name: role, role };
}

/** Every leaf condition in a where tree, flattened. */
function leaves(w: Where | undefined): Where[] {
  if (!w) return [];
  if (w.op === 'and') return (w.args as Where[]).flatMap(leaves);
  return [w];
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('getSidebarFolds', () => {
  it.each(['client', 'developer'] as const)('%s gets nothing and runs no query', async (role) => {
    expect(await repo.getSidebarFolds(ctx(role))).toEqual({ people: [], reportsTo: null });
    expect(calls).toHaveLength(0);
    expect(scoped).not.toHaveBeenCalled();
  });

  it('a manager lists only the leads who report to them', async () => {
    results = [[], []];
    scoped.mockResolvedValue([]);
    await repo.getSidebarFolds(ctx('manager', 'mgr-a'));
    const w = leaves(calls[0]?.where);
    expect(w).toContainEqual({ op: 'eq', args: ['profiles.reportsToManagerId', 'mgr-a'] });
  });

  it('a manager counts open tasks only on their own engagements (cross-tenant)', async () => {
    results = [
      [
        { id: 'lead-1', name: 'Asha', email: 'a@x' },
        { id: 'lead-2', name: null, email: 'b@x' },
      ],
      [
        { assignedTo: 'lead-1', stepId: 'pre-3' },
        { assignedTo: 'lead-1', stepId: 'todo:note' },
        { assignedTo: 'lead-2', stepId: null },
      ],
    ];
    scoped.mockResolvedValue(['eng-of-mgr-a']);
    const out = await repo.getSidebarFolds(ctx('manager', 'mgr-a'));
    expect(scoped).toHaveBeenCalledWith(expect.objectContaining({ userId: 'mgr-a', role: 'manager' }));
    const taskWhere = leaves(calls[1]?.where);
    expect(taskWhere).toContainEqual({ op: 'inArray', args: ['tasks.engagementId', ['eng-of-mgr-a']] });
    expect(taskWhere).toContainEqual({ op: 'ne', args: ['tasks.status', 'done'] });
    // The personal to-do does not count; a lead with no name shows the email.
    expect(out.people).toEqual([
      { id: 'lead-1', name: 'Asha', count: 1 },
      { id: 'lead-2', name: 'b@x', count: 1 },
    ]);
  });

  it('a manager with no engagements in scope reads no tasks', async () => {
    results = [[{ id: 'lead-1', name: 'Asha', email: 'a@x' }]];
    scoped.mockResolvedValue([]);
    const out = await repo.getSidebarFolds(ctx('manager', 'mgr-b'));
    expect(calls).toHaveLength(1);
    expect(out.people).toEqual([{ id: 'lead-1', name: 'Asha', count: 0 }]);
  });

  it.each(['admin', 'super_admin'] as const)('%s lists every manager with the live engagements they own', async (role) => {
    results = [
      [
        { id: 'm1', name: 'Pranay', email: 'p@x' },
        { id: 'm2', name: 'Krishna', email: 'k@x' },
      ],
      [{ managerId: 'm1' }, { managerId: 'm1' }],
    ];
    const out = await repo.getSidebarFolds(ctx(role));
    expect(leaves(calls[1]?.where)).toContainEqual({ op: 'isNull', args: ['engagements.deletedAt'] });
    expect(out.people).toEqual([
      { id: 'm1', name: 'Pranay', count: 2 },
      { id: 'm2', name: 'Krishna', count: 0 },
    ]);
    expect(out.reportsTo).toBeNull();
  });

  it('a lead reads only their own reports-to line', async () => {
    results = [[{ managerId: 'm1' }], [{ id: 'm1', name: 'Pranay', email: 'p@x' }]];
    const out = await repo.getSidebarFolds(ctx('intern', 'lead-9'));
    expect(leaves(calls[0]?.where)).toContainEqual({ op: 'eq', args: ['profiles.id', 'lead-9'] });
    expect(leaves(calls[1]?.where)).toContainEqual({ op: 'eq', args: ['profiles.role', 'manager'] });
    expect(out).toEqual({ people: [], reportsTo: { id: 'm1', name: 'Pranay', email: 'p@x' } });
  });

  it('a lead who reports to no one gets no manager row', async () => {
    results = [[{ managerId: null }]];
    expect(await repo.getSidebarFolds(ctx('intern'))).toEqual({ people: [], reportsTo: null });
    expect(calls).toHaveLength(1);
  });
});
