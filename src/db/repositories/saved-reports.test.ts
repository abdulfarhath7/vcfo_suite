import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Scope for saved reports (G-21): super admin only, and owner-scoped. Every read and write
 * filters on `owner_id = ctx.userId`, so another super admin's report id reads as null and
 * cannot be changed or deleted. Other roles are refused before any query.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
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
const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));

const repo = await import('@/db/repositories/saved-reports');

const dialect = new PgDialect();
const ME = 'user-super_admin';
const OTHER_OWNER = 'user-other-partner';

function ctx(role: AuthContext['role'], userId = `user-${role}`): AuthContext {
  return { userId, email: `${role}@vcfo.local`, name: role, role };
}

function reportRow(over: Record<string, unknown> = {}) {
  const now = new Date('2026-10-20T00:00:00Z');
  return {
    id: 'r-1',
    ownerId: ME,
    name: 'Partner report',
    kind: 'partner',
    params: { month: 'latest' },
    schedule: 'monthly',
    recipients: ['partner@sbc.in'],
    lastSentAt: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

const NOT_SUPER = ['admin', 'manager', 'intern', 'client', 'developer'] as const;

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('owner scope', () => {
  it('lists only the caller’s own reports', async () => {
    results = [[reportRow()]];
    const rows = await repo.listSavedReports(ctx('super_admin'));
    expect(rows).toHaveLength(1);
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.sql).toContain('"saved_reports"."owner_id" =');
    expect(q.params).toEqual([ME]);
    expect(q.params).not.toContain(OTHER_OWNER);
  });

  it('reads another owner’s report id as null', async () => {
    results = [[]];
    expect(await repo.getSavedReport(ctx('super_admin'), 'r-other')).toBeNull();
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.params).toEqual(['r-other', ME]);
  });

  it('cannot change or delete another owner’s report', async () => {
    results = [[], []];
    expect(await repo.updateSavedReport(ctx('super_admin'), 'r-other', { schedule: 'weekly' })).toBeNull();
    expect(await repo.deleteSavedReport(ctx('super_admin'), 'r-other')).toBe(false);
    for (const call of calls) {
      const q = dialect.sqlToQuery(call.where!);
      expect(q.params).toContain(ME);
    }
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('creates the row for the caller only', async () => {
    results = [[reportRow()]];
    await repo.createSavedReport(ctx('super_admin'), {
      name: 'Partner report',
      params: { month: 'latest' },
      schedule: 'monthly',
      recipients: ['partner@sbc.in'],
    });
    expect(calls[0]!.values).toMatchObject({ ownerId: ME, kind: 'partner' });
    expect(recordAuditEvent).toHaveBeenCalledOnce();
  });

  it.each(NOT_SUPER)('%s is refused before any query', async (role) => {
    await expect(repo.listSavedReports(ctx(role))).rejects.toThrow(/super admin/);
    await expect(repo.getSavedReport(ctx(role), 'r-1')).rejects.toThrow(/super admin/);
    await expect(
      repo.createSavedReport(ctx(role), { name: 'x', params: { month: 'latest' }, schedule: 'none', recipients: [] }),
    ).rejects.toThrow(/super admin/);
    await expect(repo.updateSavedReport(ctx(role), 'r-1', { name: 'y' })).rejects.toThrow(/super admin/);
    await expect(repo.deleteSavedReport(ctx(role), 'r-1')).rejects.toThrow(/super admin/);
    expect(calls).toHaveLength(0);
  });
});

describe('system helpers', () => {
  it('gives no context to an owner who is no longer an active super admin', async () => {
    results = [[{ id: 'u1', email: 'a@x.in', name: 'A', role: 'admin', status: 'active' }]];
    expect(await repo.systemReportOwnerContext('u1')).toBeNull();
    results = [[{ id: 'u2', email: 'b@x.in', name: 'B', role: 'super_admin', status: 'removed' }]];
    expect(await repo.systemReportOwnerContext('u2')).toBeNull();
    results = [[{ id: 'u3', email: 'c@x.in', name: 'C', role: 'super_admin', status: 'active' }]];
    expect(await repo.systemReportOwnerContext('u3')).toEqual({ userId: 'u3', email: 'c@x.in', name: 'C', role: 'super_admin' });
  });
});
