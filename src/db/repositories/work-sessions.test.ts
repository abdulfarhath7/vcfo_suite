import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { AuthContext } from '@/auth/guards';
import { workDbStub as stub } from '@/db/repositories/work-test-stub';

/**
 * Work sessions: reads and starts need an item the caller can resolve; a person stops
 * only their own running session; starting stops the person's running one first.
 */

vi.mock('@/db/client', async () => ({
  db: (await import('@/db/repositories/work-test-stub')).workDbStub.db,
}));
const resolveWorkItem = vi.fn();
vi.mock('@/db/repositories/work-items', () => ({ resolveWorkItem: (...a: unknown[]) => resolveWorkItem(...a) }));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn() }));

const repo = await import('@/db/repositories/work-sessions');
const dialect = new PgDialect();

const OWN = '11111111-1111-1111-1111-111111111101';
const KEY = `step:${OWN}:pre-1`;

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}
const resolved = { key: KEY, engagementId: OWN, ref: { kind: 'step', engagementId: OWN, stepId: 'pre-1' }, engagement: {} };

function session(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    itemKey: KEY,
    engagementId: OWN,
    userId: 'user-intern',
    startedAt: new Date('2026-10-29T09:00:00.000Z'),
    endedAt: new Date('2026-10-29T10:00:00.000Z'),
    note: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.reset();
});

describe('listItemSessions', () => {
  it.each(['intern', 'manager', 'admin', 'super_admin', 'client'] as const)(
    '%s gets null and no session query for an item outside its scope',
    async (role) => {
      resolveWorkItem.mockResolvedValue(null);
      expect(await repo.listItemSessions(ctx(role), `step:other:pre-1`)).toBeNull();
      expect(stub.calls).toHaveLength(0);
    },
  );

  it('totals every session and returns the caller’s running one', async () => {
    resolveWorkItem.mockResolvedValue(resolved);
    stub.queue([
      { session: session({ id: 'run', endedAt: null, startedAt: new Date(Date.now() - 60_000) }), userName: 'Lead' },
      { session: session(), userName: 'Lead' },
    ]);
    const out = await repo.listItemSessions(ctx('intern'), KEY);
    expect(out?.sessions).toHaveLength(2);
    expect(out?.running?.id).toBe('run');
    expect(out!.totalMs).toBeGreaterThanOrEqual(3_600_000 + 60_000);
    const q = dialect.sqlToQuery(stub.calls[0]!.where!);
    expect(q.params).toEqual([KEY]);
  });
});

describe('startSession', () => {
  it('writes nothing for a foreign item', async () => {
    resolveWorkItem.mockResolvedValue(null);
    expect(await repo.startSession(ctx('intern'), 'step:other:pre-1')).toBeNull();
    expect(stub.writes()).toHaveLength(0);
  });

  it('stops the caller’s running session, then starts one on the resolved key', async () => {
    resolveWorkItem.mockResolvedValue(resolved);
    stub.queue([], [session({ endedAt: null })]);
    const out = await repo.startSession(ctx('intern'), 'step:e1:pre-1');
    expect(out?.endedAt).toBeNull();
    const [stop, insert] = stub.writes();
    expect(stop!.op).toBe('update');
    const q = dialect.sqlToQuery(stop!.where!);
    expect(q.sql).toContain('"work_sessions"."user_id" = $1');
    expect(q.sql).toContain('"work_sessions"."ended_at" is null');
    expect(q.params).toEqual(['user-intern']);
    expect(insert!.op).toBe('insert');
    expect(insert!.values).toMatchObject({ itemKey: KEY, engagementId: OWN, userId: 'user-intern' });
  });
});

describe('stopSession', () => {
  it('only matches the caller’s own running session', async () => {
    stub.queue([]);
    expect(await repo.stopSession(ctx('manager'), 's1')).toBeNull();
    const q = dialect.sqlToQuery(stub.calls[0]!.where!);
    expect(q.params).toEqual(['s1', 'user-manager']);
    expect(q.sql).toContain('"work_sessions"."ended_at" is null');
  });

  it.each(['client', 'developer'] as const)('%s writes nothing', async (role) => {
    expect(await repo.stopSession(ctx(role), 's1')).toBeNull();
    expect(stub.calls).toHaveLength(0);
  });
});

describe('getRunningSession', () => {
  it('reads only the caller’s rows and refuses a client', async () => {
    stub.queue([]);
    expect(await repo.getRunningSession(ctx('intern'))).toBeNull();
    expect(dialect.sqlToQuery(stub.calls[0]!.where!).params).toEqual(['user-intern']);
    stub.reset();
    expect(await repo.getRunningSession(ctx('client'))).toBeNull();
    expect(stub.calls).toHaveLength(0);
  });
});
