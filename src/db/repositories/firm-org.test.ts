import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * firm-org (G-20):
 *   listReportingLines / setManagerAdmin — super admin and admin only
 *   createDeveloperProfile — super admin only
 * Everyone else is refused before a query and writes nothing.
 */

type Call = { op: string; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    where: () => c,
    limit: () => c,
    returning: () => c,
    set: (s: unknown) => {
      call.set = s;
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

const repo = await import('@/db/repositories/firm-org');

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('reporting lines', () => {
  it.each(['manager', 'intern', 'client', 'developer'] as const)('%s is refused before any query', async (role) => {
    await expect(repo.listReportingLines(ctx(role))).rejects.toBeInstanceOf(repo.FirmOrgForbiddenError);
    await expect(repo.setManagerAdmin(ctx(role), 'm1', 'a1')).rejects.toBeInstanceOf(repo.FirmOrgForbiddenError);
    expect(calls).toHaveLength(0);
  });

  it.each(['admin', 'super_admin'] as const)('%s lists every manager and admin pair', async (role) => {
    results = [[{ id: 'm1', adminId: 'a1' }, { id: 'm2', adminId: null }]];
    expect(await repo.listReportingLines(ctx(role))).toEqual([
      { managerId: 'm1', adminId: 'a1' },
      { managerId: 'm2', adminId: null },
    ]);
  });

  it('sets the admin and audits old and new', async () => {
    results = [
      [
        { id: 'm1', name: 'Pranay', email: 'p@x', role: 'manager', reportsToAdminId: null },
        { id: 'a1', name: 'Krishna', email: 'k@x', role: 'admin', reportsToAdminId: null },
      ],
      [],
    ];
    await repo.setManagerAdmin(ctx('super_admin'), 'm1', 'a1');
    expect(writes()[0]!.set).toMatchObject({ reportsToAdminId: 'a1' });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      ctx('super_admin'),
      expect.objectContaining({ action: 'manager.reports_to_admin', metadata: { managerId: 'm1', old: null, new: 'a1' } }),
    );
  });

  it('refuses a target who is not a manager, or an admin who is not an admin', async () => {
    results = [[{ id: 'm1', name: 'Lead', email: 'l@x', role: 'intern', reportsToAdminId: null }]];
    await expect(repo.setManagerAdmin(ctx('admin'), 'm1', null)).rejects.toThrow('manager_not_found');
    results = [
      [
        { id: 'm1', name: 'Pranay', email: 'p@x', role: 'manager', reportsToAdminId: null },
        { id: 'c1', name: 'Client', email: 'c@x', role: 'client', reportsToAdminId: null },
      ],
    ];
    await expect(repo.setManagerAdmin(ctx('admin'), 'm1', 'c1')).rejects.toThrow('admin_not_found');
    expect(writes()).toHaveLength(0);
  });
});

describe('createDeveloperProfile', () => {
  it.each(['admin', 'manager', 'intern', 'client', 'developer'] as const)('%s may not create developers', async (role) => {
    await expect(
      repo.createDeveloperProfile(ctx(role), { email: 'd@x.in', password: 'password1' }),
    ).rejects.toBeInstanceOf(repo.FirmOrgForbiddenError);
    expect(calls).toHaveLength(0);
  });

  it('the super admin creates a developer account', async () => {
    results = [[], [{ id: 'd1', email: 'dev@sbcllp.in', name: 'Dev' }]];
    const out = await repo.createDeveloperProfile(ctx('super_admin'), {
      email: ' Dev@SBCLLP.in ',
      password: 'password1',
      fullName: 'Dev',
    });
    expect(out).toEqual({ userId: 'd1', name: 'Dev', email: 'dev@sbcllp.in' });
    expect(writes()[0]!.values).toMatchObject({ email: 'dev@sbcllp.in', role: 'developer', status: 'active' });
  });
});
