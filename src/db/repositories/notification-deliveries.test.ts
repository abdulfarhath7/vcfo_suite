import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Delivery log is a staff diagnostic surface:
 *   admin / super_admin — firm-wide
 *   manager — engagements they own or co-manage
 *   intern  — engagements they lead (primary or engagement_leads)
 *   client  — nothing
 * Asking for an engagement outside scope returns [] and never reads the log.
 * (`systemRecordDelivery` / `systemUpdateDeliveryByProviderId` are job-only
 * writers with no AuthContext, so they have no scoping to test here.)
 */

type Call = { op: string; where?: SQL };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    orderBy: () => c,
    limit: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
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

const managerOwnsEngagement = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  managerOwnsEngagement: (...a: unknown[]) => managerOwnsEngagement(...a),
}));

const listLeadMemberEngagementIds = vi.fn();
vi.mock('@/db/repositories/engagement-leads-membership', () => ({
  listLeadMemberEngagementIds: (...a: unknown[]) => listLeadMemberEngagementIds(...a),
}));

const { listDeliveriesByEngagement } = await import('@/db/repositories/notification-deliveries');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role'], extra: Partial<AuthContext> = {}): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role, ...extra };
}

function deliveryRow() {
  return {
    delivery: {
      id: 'd-1',
      eventType: 'step.delivered',
      channel: 'email',
      status: 'sent',
      skipReason: null,
      errorCode: null,
      toAddress: 'a@b.test',
      createdAt: new Date(),
    },
    recipientName: 'R',
    recipientEmail: 'r@b.test',
  };
}

/** The delivery read is the last select; it must be keyed on the asked engagement. */
function deliveryQueryEngagement(): unknown {
  const q = dialect.sqlToQuery(calls.at(-1)!.where!);
  expect(q.sql).toContain('"notification_deliveries"."engagement_id" = $');
  return q.params[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  managerOwnsEngagement.mockReturnValue(sql`manager_owns`);
  listLeadMemberEngagementIds.mockResolvedValue([]);
});

describe('listDeliveriesByEngagement', () => {
  it.each(['admin', 'super_admin'] as const)('%s reads any engagement directly', async (role) => {
    results = [[deliveryRow()]];
    const out = await listDeliveriesByEngagement(ctx(role), OTHER);
    expect(out).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(deliveryQueryEngagement()).toBe(OTHER);
  });

  it('client gets nothing and the log is never read', async () => {
    const out = await listDeliveriesByEngagement(ctx('client', { clientId: 'c1' }), OWN);
    expect(out).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('manager scope is built from managerOwnsEngagement(self)', async () => {
    results = [[{ id: OWN }], [deliveryRow()]];
    const out = await listDeliveriesByEngagement(ctx('manager'), OWN);
    expect(managerOwnsEngagement).toHaveBeenCalledWith('user-manager');
    expect(out).toHaveLength(1);
    expect(deliveryQueryEngagement()).toBe(OWN);
  });

  it('manager asking for another firm’s engagement gets [] without reading the log', async () => {
    results = [[{ id: OWN }]];
    const out = await listDeliveriesByEngagement(ctx('manager'), OTHER);
    expect(out).toEqual([]);
    expect(calls).toHaveLength(1); // only the scope lookup
  });

  it('intern without an internId gets nothing', async () => {
    expect(await listDeliveriesByEngagement(ctx('intern'), OWN)).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('intern scope is its own intern_id plus lead memberships', async () => {
    listLeadMemberEngagementIds.mockResolvedValue([OWN]);
    results = [[{ id: OWN }], [deliveryRow()]];
    const out = await listDeliveriesByEngagement(ctx('intern', { internId: 'i1' }), OWN);
    expect(listLeadMemberEngagementIds).toHaveBeenCalledWith('i1');
    const scope = dialect.sqlToQuery(calls[0]!.where!);
    expect(scope.params).toEqual(expect.arrayContaining(['i1', OWN]));
    expect(out).toHaveLength(1);
  });

  it('intern asking for an engagement it does not lead gets []', async () => {
    results = [[{ id: OWN }]];
    const out = await listDeliveriesByEngagement(ctx('intern', { internId: 'i1' }), OTHER);
    expect(out).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('blank engagement id is [] for everyone', async () => {
    expect(await listDeliveriesByEngagement(ctx('admin'), '  ')).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
