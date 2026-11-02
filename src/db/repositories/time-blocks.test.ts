import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { AuthContext } from '@/auth/guards';
import { workDbStub as stub } from '@/db/repositories/work-test-stub';
import { istIso } from '@/lib/work/planner';

/**
 * Time blocks: own rows only; a block on an item needs an item the caller can resolve;
 * a list hides blocks on engagements outside the caller's scope.
 */

vi.mock('@/db/client', async () => ({
  db: (await import('@/db/repositories/work-test-stub')).workDbStub.db,
}));
const resolveWorkItem = vi.fn();
vi.mock('@/db/repositories/work-items', () => ({ resolveWorkItem: (...a: unknown[]) => resolveWorkItem(...a) }));
const listScopedEngagementIds = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
}));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn() }));

const repo = await import('@/db/repositories/time-blocks');
const dialect = new PgDialect();

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const KEY = `step:${OWN}:pre-1`;
const range = { from: istIso('2026-10-26', '00:00'), to: istIso('2026-11-02', '00:00') };
const block = { title: 'Focus', startsAt: istIso('2026-10-27', '10:00'), endsAt: istIso('2026-10-27', '11:00') };

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}
function row(over: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    userId: 'user-intern',
    itemKey: null,
    engagementId: null,
    title: 'Focus',
    startsAt: new Date(block.startsAt),
    endsAt: new Date(block.endsAt),
    createdAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.reset();
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('listTimeBlocks', () => {
  it.each(['intern', 'manager'] as const)('%s reads own rows, limited to scoped engagements', async (role) => {
    stub.queue([]);
    await repo.listTimeBlocks(ctx(role), range);
    const q = dialect.sqlToQuery(stub.calls[0]!.where!);
    expect(q.params).toContain(`user-${role}`);
    expect(q.params).toContain(OWN);
    expect(q.params).not.toContain(OTHER);
    expect(q.sql).toContain('"time_blocks"."engagement_id" is null');
  });

  it.each(['admin', 'super_admin'] as const)('%s reads own rows without an engagement filter', async (role) => {
    stub.queue([]);
    await repo.listTimeBlocks(ctx(role), range);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    expect(dialect.sqlToQuery(stub.calls[0]!.where!).params).toContain(`user-${role}`);
  });

  it('a lead with no engagements still only sees free blocks', async () => {
    listScopedEngagementIds.mockResolvedValue([]);
    stub.queue([]);
    await repo.listTimeBlocks(ctx('intern'), range);
    expect(dialect.sqlToQuery(stub.calls[0]!.where!).sql).toContain('"time_blocks"."engagement_id" is null');
  });

  it('refuses a client and a bad range', async () => {
    expect(await repo.listTimeBlocks(ctx('client'), range)).toEqual([]);
    expect(stub.calls).toHaveLength(0);
    await expect(repo.listTimeBlocks(ctx('intern'), { from: range.to, to: range.from })).rejects.toThrow('invalid_range');
  });
});

describe('createTimeBlocks', () => {
  it('writes nothing when one block names an item outside the scope', async () => {
    resolveWorkItem.mockResolvedValue(null);
    expect(await repo.createTimeBlocks(ctx('intern'), [block, { ...block, itemKey: `step:${OTHER}:pre-1` }])).toBeNull();
    expect(stub.writes()).toHaveLength(0);
  });

  it('refuses an invalid range before any write', async () => {
    await expect(repo.createTimeBlocks(ctx('intern'), [{ ...block, endsAt: block.startsAt }])).rejects.toThrow(
      'invalid_range',
    );
    expect(stub.writes()).toHaveLength(0);
  });

  it('stores the resolved key and engagement for the caller', async () => {
    resolveWorkItem.mockResolvedValue({ key: KEY, engagementId: OWN });
    stub.queue([row({ itemKey: KEY, engagementId: OWN })]);
    await repo.createTimeBlocks(ctx('intern'), [{ ...block, itemKey: 'step:e1:pre-1' }]);
    expect(stub.writes()[0]!.values).toEqual([
      expect.objectContaining({ userId: 'user-intern', itemKey: KEY, engagementId: OWN, title: 'Focus' }),
    ]);
  });
});

describe('updateTimeBlock / deleteTimeBlock', () => {
  it('another person’s block reads as missing and is never written', async () => {
    stub.queue([]);
    expect(await repo.updateTimeBlock(ctx('manager'), 'b1', { title: 'x' })).toBeNull();
    expect(dialect.sqlToQuery(stub.calls[0]!.where!).params).toEqual(['b1', 'user-manager']);
    stub.queue([]);
    expect(await repo.deleteTimeBlock(ctx('manager'), 'b1')).toBe(false);
    expect(stub.writes()).toHaveLength(0);
  });

  it('moves an own block to new times', async () => {
    stub.queue([row()], [row()]);
    const startsAt = istIso('2026-10-28', '14:00');
    const endsAt = istIso('2026-10-28', '15:30');
    await repo.updateTimeBlock(ctx('intern'), 'b1', { startsAt, endsAt });
    const write = stub.writes()[0]!;
    expect(write.set).toMatchObject({ startsAt: new Date(startsAt), endsAt: new Date(endsAt) });
    expect(dialect.sqlToQuery(write.where!).params).toEqual(['b1', 'user-intern']);
  });
});

describe('listLeadTimeBlocks', () => {
  const LEAD = { id: 'lead-profile', reportsTo: 'someone-else' };

  it.each(['intern', 'client'] as const)('%s is refused and reads nothing', async (role) => {
    await expect(repo.listLeadTimeBlocks(ctx(role), 'i1', range)).rejects.toThrow(/forbidden/);
    expect(stub.calls).toHaveLength(0);
  });

  it('a manager cannot read a lead who neither reports to them nor leads one of their clients', async () => {
    stub.queue([LEAD], [], []);
    await expect(repo.listLeadTimeBlocks(ctx('manager'), 'i1', range)).rejects.toThrow(/forbidden/);
    expect(stub.calls.filter((c) => c.where && dialect.sqlToQuery(c.where).sql.includes('"time_blocks"'))).toHaveLength(0);
  });

  it('a manager reads the lead’s blocks on the manager’s own engagements only', async () => {
    stub.queue([LEAD], [{ id: OWN }], [row({ userId: 'lead-profile', engagementId: OWN })]);
    const out = await repo.listLeadTimeBlocks(ctx('manager'), 'i1', range);
    expect(out).toHaveLength(1);
    const q = dialect.sqlToQuery(stub.calls[2]!.where!);
    expect(q.params).toContain('lead-profile');
    expect(q.params).toContain(OWN);
    expect(q.params).not.toContain(OTHER);
    expect(q.sql).not.toContain('"time_blocks"."engagement_id" is null');
  });

  it('free blocks show only when the lead reports to the manager', async () => {
    stub.queue([{ id: 'lead-profile', reportsTo: 'user-manager' }], [], [], []);
    await repo.listLeadTimeBlocks(ctx('manager'), 'i1', range);
    const last = stub.calls[stub.calls.length - 1]!;
    expect(dialect.sqlToQuery(last.where!).sql).toContain('"time_blocks"."engagement_id" is null');
  });

  it('an admin reads any lead without an engagement filter', async () => {
    stub.queue([LEAD], []);
    await repo.listLeadTimeBlocks(ctx('admin'), 'i1', range);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    expect(dialect.sqlToQuery(stub.calls[1]!.where!).params).toContain('lead-profile');
  });
});
