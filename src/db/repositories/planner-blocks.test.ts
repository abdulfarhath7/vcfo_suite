import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * Planner blocks (Path A): a lead plans only their own calendar; a manager
 * their own and their leads' (book leads + reports); admins everyone;
 * clients nothing. Blocks outside the scope read as not found. Until the
 * migration runs, reads are empty and writes say `planner_not_ready`.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: Array<unknown[] | Error> = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
    where: (w: SQL) => ((call.where = w), c),
    values: (v: unknown) => ((call.values = v), c),
    set: (s: unknown) => ((call.set = s), c),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
      const next = results.shift() ?? [];
      return (next instanceof Error ? Promise.reject(next) : Promise.resolve(next)).then(res, rej);
    },
  };
  return c;
}
const op = (name: string) => () => {
  const call: Call = { op: name };
  calls.push(call);
  return chain(call);
};
vi.mock('@/db/client', () => ({ db: { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') } }));

const listBookLeads = vi.fn();
const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/book-leads', () => ({ listBookLeads: (...a: unknown[]) => listBookLeads(...a) }));
vi.mock('@/db/repositories/engagements', () => ({ assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a) }));

const repo = await import('@/db/repositories/planner-blocks');
const dialect = new PgDialect();

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `me-${role}`, email: `${role}@x`, name: role, role, internId: role === 'intern' ? 'i1' : undefined });
const row = (ownerId: string, extra: Record<string, unknown> = {}) => ({
  id: 'b1',
  ownerId,
  createdBy: ownerId,
  engagementId: null,
  itemRef: null,
  title: 'GST working',
  day: '2026-10-30',
  startMin: 600,
  endMin: 660,
  createdAt: new Date(),
  updatedAt: new Date('2026-10-29T10:00:00Z'),
  ...extra,
});
const block = { title: 'GST working', day: '2026-10-30', startMin: 600, endMin: 660 };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('plannerOwnerScope', () => {
  it('refuses clients and gives a lead only themselves', async () => {
    await expect(repo.plannerOwnerScope(ctx('client'))).rejects.toThrow('not_permitted');
    expect([...((await repo.plannerOwnerScope(ctx('intern'))) as Set<string>)]).toEqual(['me-intern']);
  });

  it('gives a manager self + book leads + reports, nobody else', async () => {
    listBookLeads.mockResolvedValue([{ profileId: 'lead-a' }, { profileId: null }]);
    results = [[{ id: 'lead-r' }]];
    const s = (await repo.plannerOwnerScope(ctx('manager'))) as Set<string>;
    expect([...s].sort()).toEqual(['lead-a', 'lead-r', 'me-manager']);
    expect(dialect.sqlToQuery(calls[0]!.where!).params).toEqual(['intern', 'me-manager']);
  });

  it('gives firm-wide admins everyone', async () => {
    expect(await repo.plannerOwnerScope(ctx('admin'))).toBe('all');
  });
});

describe('listPlannerBlocks', () => {
  it('drops owners outside the scope and reads only the allowed ones in the range', async () => {
    listBookLeads.mockResolvedValue([{ profileId: 'lead-a' }]);
    results = [[], [row('lead-a')]];
    const out = await repo.listPlannerBlocks(ctx('manager'), { ownerIds: ['lead-a', 'stranger'], from: '2026-10-26', to: '2026-11-01' });
    expect(out.map((b) => b.ownerId)).toEqual(['lead-a']);
    const q = dialect.sqlToQuery(calls[1]!.where!);
    expect(q.params).toEqual(['lead-a', '2026-10-26', '2026-11-01']);
  });

  it('a lead asking for someone else reads nothing', async () => {
    expect(await repo.listPlannerBlocks(ctx('intern'), { ownerIds: ['lead-b'], from: '2026-10-26', to: '2026-11-01' })).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('degrades to an empty list before the migration runs', async () => {
    results = [Object.assign(new Error('relation "planner_blocks" does not exist'), { code: '42P01' })];
    expect(await repo.listPlannerBlocks(ctx('intern'), { from: '2026-10-26', to: '2026-11-01' })).toEqual([]);
  });
});

describe('createPlannerBlocks', () => {
  it('a lead cannot write on another calendar', async () => {
    await expect(repo.createPlannerBlocks(ctx('intern'), [{ ...block, ownerId: 'lead-b' }])).rejects.toThrow('not_permitted');
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('checks times and the client before writing', async () => {
    await expect(repo.createPlannerBlocks(ctx('intern'), [{ ...block, startMin: 480 }])).rejects.toThrow('outside_day');
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: 'e9', forbidden: true });
    await expect(repo.createPlannerBlocks(ctx('intern'), [{ ...block, engagementId: 'e9' }])).rejects.toThrow('not_permitted');
  });

  it('a manager plans a lead in scope; created_by is the manager', async () => {
    listBookLeads.mockResolvedValue([{ profileId: 'lead-a' }]);
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: 'db-e1' });
    results = [[], [row('lead-a', { engagementId: 'db-e1' })]];
    const out = await repo.createPlannerBlocks(ctx('manager'), [{ ...block, ownerId: 'lead-a', engagementId: 'e1', itemRef: 'task:t1' }]);
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.values).toEqual([expect.objectContaining({ ownerId: 'lead-a', createdBy: 'me-manager', engagementId: 'db-e1', itemRef: 'task:t1' })]);
    expect(out[0]!.ownerId).toBe('lead-a');
  });

  it('says planner_not_ready when the table is missing', async () => {
    results = [Object.assign(new Error('x'), { cause: { code: '42P01' } })];
    await expect(repo.createPlannerBlocks(ctx('intern'), [block])).rejects.toThrow('planner_not_ready');
  });
});

describe('update / delete', () => {
  it('a block outside the scope reads as not found', async () => {
    results = [[row('someone-else')]];
    expect(await repo.updatePlannerBlock(ctx('intern'), 'b1', { startMin: 630 })).toBeNull();
    results = [[row('someone-else')]];
    expect(await repo.deletePlannerBlock(ctx('intern'), 'b1')).toBe(false);
    expect(calls.some((c) => c.op === 'update' || c.op === 'delete')).toBe(false);
  });

  it('resizes an own block within the day rules', async () => {
    results = [[row('me-intern')], [row('me-intern', { startMin: 630 })]];
    const out = await repo.updatePlannerBlock(ctx('intern'), 'b1', { startMin: 630 });
    expect(calls.find((c) => c.op === 'update')!.set).toEqual(expect.objectContaining({ startMin: 630, endMin: 660, day: '2026-10-30' }));
    expect(out?.startMin).toBe(630);
    results = [[row('me-intern')]];
    await expect(repo.updatePlannerBlock(ctx('intern'), 'b1', { endMin: 610 })).rejects.toThrow('too_short');
  });
});
