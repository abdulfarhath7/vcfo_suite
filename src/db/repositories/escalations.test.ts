import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * escalations (G-20):
 *   list    — super admin / admin: all; manager / lead: engagements in their scope only;
 *             client / developer: refused before a query
 *   raise   — staff, on an engagement `assertEngagementAccess` approves; written against its db id
 *   resolve — super admin / admin only, with a note
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

const listScopedEngagementIds = vi.fn();
const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));

const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));

const queueStaffAlert = vi.fn();
vi.mock('@/lib/notify/staff-alerts', () => ({ queueStaffAlert: (...a: unknown[]) => queueStaffAlert(...a) }));

const repo = await import('@/db/repositories/escalations');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

function escRow(engagementId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'esc-1',
    engagementId,
    companyName: 'Acme India',
    reason: 'Client silent for two weeks',
    status: 'open',
    raisedBy: null,
    assignedTo: null,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNote: null,
    createdAt: new Date('2026-10-20T00:00:00Z'),
    ...overrides,
  };
}

const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('listEscalations', () => {
  it.each(['admin', 'super_admin'] as const)('%s lists all without a scope lookup', async (role) => {
    results = [[escRow(OWN), escRow(OTHER, { id: 'esc-2' })]];
    expect(await repo.listEscalations(ctx(role))).toHaveLength(2);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.params).not.toContain(OWN);
  });

  it.each(['manager', 'intern'] as const)('%s only sees its scoped engagements', async (role) => {
    await repo.listEscalations(ctx(role));
    expect(listScopedEngagementIds).toHaveBeenCalledWith(ctx(role));
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.sql).toContain('"escalations"."engagement_id" in');
    expect(q.params).toContain(OWN);
    expect(q.params).not.toContain(OTHER);
  });

  it.each(['manager', 'intern'] as const)('%s with no engagements gets [] and no query', async (role) => {
    listScopedEngagementIds.mockResolvedValue([]);
    expect(await repo.listEscalations(ctx(role))).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it.each(['client', 'developer'] as const)('%s is refused before any query', async (role) => {
    await expect(repo.listEscalations(ctx(role))).rejects.toBeInstanceOf(repo.EscalationForbiddenError);
    expect(calls).toHaveLength(0);
  });

  it('an engagement filter on a foreign engagement returns []', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
    expect(await repo.listEscalations(ctx('manager'), { engagementId: OTHER })).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('raiseEscalation', () => {
  it.each(['manager', 'intern'] as const)('%s cannot raise on a foreign engagement', async (role) => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
    await expect(
      repo.raiseEscalation(ctx(role), { engagementId: OTHER, reason: 'Stuck' }),
    ).rejects.toBeInstanceOf(repo.EscalationForbiddenError);
    expect(writes()).toHaveLength(0);
  });

  it('clients cannot raise at all', async () => {
    await expect(
      repo.raiseEscalation(ctx('client'), { engagementId: OWN, reason: 'Stuck' }),
    ).rejects.toBeInstanceOf(repo.EscalationForbiddenError);
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });

  it('writes against the approved db id and audits', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { companyName: 'Acme India' } });
    results = [[escRow(OWN, { raisedBy: 'user-manager' })], [{ id: 'user-manager', name: 'Pranay', email: 'p@x' }]];
    const out = await repo.raiseEscalation(ctx('manager'), { engagementId: 'e1', reason: 'Stuck' });
    expect(writes()[0]!.values).toMatchObject({ engagementId: OWN, raisedBy: 'user-manager', reason: 'Stuck' });
    expect(out.raisedByName).toBe('Pranay');
    expect(recordAuditEvent).toHaveBeenCalledWith(ctx('manager'), expect.objectContaining({ action: 'escalation.raise', engagementId: OWN }));
    // The admins' email alert is queued against the approved engagement id.
    expect(queueStaffAlert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'escalation', engagementDbId: OWN, reason: 'Stuck' }));
  });

  it('refuses an assignee who is not an admin', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { companyName: 'Acme India' } });
    results = [[{ id: 'p1', role: 'manager' }]];
    await expect(
      repo.raiseEscalation(ctx('manager'), { engagementId: OWN, reason: 'Stuck', assignedTo: 'p1' }),
    ).rejects.toThrow('assignee_not_admin');
    expect(writes()).toHaveLength(0);
    expect(queueStaffAlert).not.toHaveBeenCalled();
  });
});

describe('resolveEscalation', () => {
  it.each(['manager', 'intern', 'client', 'developer'] as const)('%s cannot resolve', async (role) => {
    await expect(repo.resolveEscalation(ctx(role), 'esc-1', 'Done')).rejects.toBeInstanceOf(
      repo.EscalationForbiddenError,
    );
    expect(calls).toHaveLength(0);
  });

  it.each(['admin', 'super_admin'] as const)('%s resolves an open escalation with a note', async (role) => {
    results = [[escRow(OWN)], [], []];
    const out = await repo.resolveEscalation(ctx(role), 'esc-1', 'Called the client');
    expect(out?.status).toBe('resolved');
    expect(writes()[0]!.set).toMatchObject({ status: 'resolved', resolvedBy: `user-${role}`, resolutionNote: 'Called the client' });
    expect(recordAuditEvent).toHaveBeenCalledWith(ctx(role), expect.objectContaining({ action: 'escalation.resolve' }));
  });

  it('returns null for a missing escalation and writes nothing', async () => {
    results = [[]];
    expect(await repo.resolveEscalation(ctx('admin'), 'nope', 'x')).toBeNull();
    expect(writes()).toHaveLength(0);
  });
});
