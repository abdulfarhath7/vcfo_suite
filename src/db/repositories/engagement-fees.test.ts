import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * Engagement fees (P-100): super admin, admin and the engagement's manager only; the engagement
 * is read through `getEngagementById`, so a foreign engagement is not found and nothing is read
 * or written; writes are filtered by the approved engagement id and the line id.
 */

type Call = { op: string; where?: SQL; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    limit: () => c,
    orderBy: () => c,
    values: (v: unknown) => {
      call.set = v;
      return c;
    },
    returning: () => c,
    set: (s: unknown) => {
      call.set = s;
      return c;
    },
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}
const op = (name: string) => () => {
  const call: Call = { op: name };
  calls.push(call);
  return chain(call);
};
vi.mock('@/db/client', () => ({ db: { select: op('select'), update: op('update'), insert: op('insert'), delete: op('delete') } }));
vi.mock('server-only', () => ({}));
const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));

const OWN = '11111111-1111-4111-8111-111111111101';
const OTHER = '22222222-2222-4222-8222-222222222202';
const FEE = '33333333-3333-4333-8333-333333333303';
const getEngagementById = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  getEngagementById: (...a: unknown[]) => getEngagementById(...a),
}));

const { listEngagementFees, addEngagementFee, updateEngagementFee, deleteEngagementFee } = await import(
  '@/db/repositories/engagement-fees'
);
const dialect = new PgDialect();

function ctx(role: string): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role: role as AuthContext['role'] };
}

const row = {
  id: FEE,
  engagementId: OWN,
  service: 'Incorporation',
  amountRupees: 25000,
  billing: 'one_time',
  status: 'billed',
  billedOn: '2026-10-01',
  paidOn: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
};
const input = { service: 'Incorporation', amountRupees: 25000, billing: 'one_time' as const, status: 'billed' as const };

beforeEach(() => {
  calls.length = 0;
  results = [];
  recordAuditEvent.mockReset();
  getEngagementById.mockReset();
  getEngagementById.mockImplementation(async (_c: AuthContext, id: string) => (id === OWN ? { id: OWN } : null));
});

describe('engagement fees', () => {
  it.each(['intern', 'client', 'developer'])('%s is refused before any read', async (role) => {
    await expect(listEngagementFees(ctx(role), OWN)).rejects.toThrow(/Only an admin or the manager/);
    await expect(addEngagementFee(ctx(role), OWN, input)).rejects.toThrow(/Only an admin or the manager/);
    expect(getEngagementById).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'admin', 'super_admin'])('%s reads nothing and writes nothing on another engagement', async (role) => {
    await expect(listEngagementFees(ctx(role), OTHER)).rejects.toThrow(/not found/);
    await expect(addEngagementFee(ctx(role), OTHER, input)).rejects.toThrow(/not found/);
    await expect(updateEngagementFee(ctx(role), OTHER, FEE, input)).rejects.toThrow(/not found/);
    await expect(deleteEngagementFee(ctx(role), OTHER, FEE)).rejects.toThrow(/not found/);
    expect(calls).toHaveLength(0);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('lists the approved engagement only', async () => {
    results = [[row]];
    const fees = await listEngagementFees(ctx('manager'), OWN);
    expect(fees).toHaveLength(1);
    expect(dialect.sqlToQuery(calls[0]!.where!).params).toEqual([OWN]);
  });

  it('adds a billed line with today as the invoice day and audits it', async () => {
    results = [[row]];
    await addEngagementFee(ctx('admin'), OWN, input, '2026-10-30');
    const ins = calls.find((c) => c.op === 'insert')!;
    expect(ins.set).toMatchObject({ engagementId: OWN, billedOn: '2026-10-30', paidOn: null, createdBy: 'user-admin' });
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
  });

  it('updates a line only on the approved engagement', async () => {
    results = [[{ ...row, status: 'paid', paidOn: '2026-10-30' }]];
    await updateEngagementFee(ctx('manager'), OWN, FEE, { ...input, status: 'paid', billedOn: '2026-10-01' }, '2026-10-30');
    const u = calls.find((c) => c.op === 'update')!;
    expect(u.set).toMatchObject({ status: 'paid', billedOn: '2026-10-01', paidOn: '2026-10-30' });
    expect(dialect.sqlToQuery(u.where!).params).toEqual([FEE, OWN]);
  });

  it('says not found when the line is not on the engagement', async () => {
    results = [[]];
    await expect(deleteEngagementFee(ctx('admin'), OWN, FEE)).rejects.toThrow(/Fee not found/);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
