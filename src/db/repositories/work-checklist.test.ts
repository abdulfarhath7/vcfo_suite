import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { AuthContext } from '@/auth/guards';
import { workDbStub as stub } from '@/db/repositories/work-test-stub';

/**
 * Personal checklist: every read and write is the caller's own rows on an item they
 * can resolve. Another person's row, or a row whose item left the scope, reads as
 * missing and is never written.
 */

vi.mock('@/db/client', async () => ({
  db: (await import('@/db/repositories/work-test-stub')).workDbStub.db,
}));
const resolveWorkItem = vi.fn();
vi.mock('@/db/repositories/work-items', () => ({ resolveWorkItem: (...a: unknown[]) => resolveWorkItem(...a) }));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn() }));

const repo = await import('@/db/repositories/work-checklist');
const dialect = new PgDialect();

const OWN = '11111111-1111-1111-1111-111111111101';
const KEY = `step:${OWN}:pre-1`;
const resolved = { key: KEY, engagementId: OWN, ref: {}, engagement: {} };

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}
function row(id: string, position: number) {
  return { id, itemKey: KEY, engagementId: OWN, label: id, done: false, position, createdBy: 'user-intern', createdAt: new Date(), updatedAt: new Date() };
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.reset();
});

describe('listChecklist', () => {
  it('returns null and runs no query for an item outside the scope', async () => {
    resolveWorkItem.mockResolvedValue(null);
    expect(await repo.listChecklist(ctx('manager'), 'step:other:pre-1')).toBeNull();
    expect(stub.calls).toHaveLength(0);
  });

  it('reads only the caller’s rows on the item', async () => {
    resolveWorkItem.mockResolvedValue(resolved);
    stub.queue([row('a', 0)]);
    expect(await repo.listChecklist(ctx('intern'), KEY)).toHaveLength(1);
    expect(dialect.sqlToQuery(stub.calls[0]!.where!).params).toEqual([KEY, 'user-intern']);
  });
});

describe('addChecklistItem', () => {
  it('writes nothing for a foreign item and refuses an empty label', async () => {
    resolveWorkItem.mockResolvedValue(null);
    expect(await repo.addChecklistItem(ctx('intern'), 'step:other:pre-1', 'Call')).toBeNull();
    await expect(repo.addChecklistItem(ctx('intern'), KEY, '   ')).rejects.toThrow('invalid_label');
    expect(stub.writes()).toHaveLength(0);
  });

  it('appends after the last position', async () => {
    resolveWorkItem.mockResolvedValue(resolved);
    stub.queue([row('a', 0), row('b', 4)], [row('c', 5)]);
    await repo.addChecklistItem(ctx('intern'), KEY, 'Call the client');
    expect(stub.writes()[0]!.values).toMatchObject({ itemKey: KEY, position: 5, createdBy: 'user-intern' });
  });
});

describe('updateChecklistItem / deleteChecklistItem', () => {
  it('another person’s row reads as missing and is never written', async () => {
    stub.queue([]);
    expect(await repo.updateChecklistItem(ctx('manager'), 'a', { done: true })).toBeNull();
    expect(dialect.sqlToQuery(stub.calls[0]!.where!).params).toEqual(['a', 'user-manager']);
    stub.queue([]);
    expect(await repo.deleteChecklistItem(ctx('manager'), 'a')).toBe(false);
    expect(stub.writes()).toHaveLength(0);
  });

  it('an own row on an item that left the scope is not written', async () => {
    stub.queue([row('a', 0)]);
    resolveWorkItem.mockResolvedValue(null);
    expect(await repo.updateChecklistItem(ctx('intern'), 'a', { done: true })).toBeNull();
    expect(stub.writes()).toHaveLength(0);
  });

  it.each(['client', 'developer'] as const)('%s runs no query', async (role) => {
    expect(await repo.updateChecklistItem(ctx(role), 'a', { done: true })).toBeNull();
    expect(stub.calls).toHaveLength(0);
  });
});

describe('reorderChecklist', () => {
  it('refuses an order that names rows the caller does not own', async () => {
    resolveWorkItem.mockResolvedValue(resolved);
    stub.queue([row('a', 0), row('b', 1)]);
    await expect(repo.reorderChecklist(ctx('intern'), KEY, ['b', 'zz'])).rejects.toThrow('invalid_order');
    expect(stub.writes()).toHaveLength(0);
  });

  it('writes the new positions on the caller’s rows', async () => {
    resolveWorkItem.mockResolvedValue(resolved);
    stub.queue([row('a', 0), row('b', 1)]);
    const out = await repo.reorderChecklist(ctx('intern'), KEY, ['b', 'a']);
    expect(out?.map((r) => [r.id, r.position])).toEqual([
      ['b', 0],
      ['a', 1],
    ]);
    const updates = stub.writes();
    expect(updates).toHaveLength(2);
    expect(dialect.sqlToQuery(updates[0]!.where!).params).toEqual(['b', 'user-intern']);
  });
});
