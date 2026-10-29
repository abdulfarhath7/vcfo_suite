import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Client reminders (G-15): staff only, on an engagement in scope, and the item must belong to
 * that engagement. A filing, request or task from another engagement resolves to nothing.
 */

type Call = { op: string; where?: SQL; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    innerJoin: () => c,
    orderBy: () => c,
    limit: () => c,
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

const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  listScopedEngagementIds: vi.fn(),
}));

const repo = await import('@/db/repositories/client-reminders');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const FILING = '33333333-3333-4333-8333-333333333303';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role, internId: role === 'intern' ? 'i1' : undefined };
}

const allowed = { ok: true, dbId: OWN, row: { companyName: 'Acme' } };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('resolveReminderTarget', () => {
  it.each(['client', 'developer'] as const)('%s is refused before any query', async (role) => {
    expect(await repo.resolveReminderTarget(ctx(role), OWN, `filing:${FILING}`)).toEqual({ ok: false, reason: 'not_found' });
    expect(assertEngagementAccess).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'intern'] as const)('%s gets nothing on another firm’s engagement', async (role) => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER, forbidden: true });
    expect(await repo.resolveReminderTarget(ctx(role), OTHER, `filing:${FILING}`)).toEqual({ ok: false, reason: 'not_found' });
    expect(calls).toHaveLength(0);
  });

  it('a filing is looked up on the approved engagement only', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [[]];
    expect(await repo.resolveReminderTarget(ctx('manager'), 'e1', `filing:${FILING}`)).toEqual({ ok: false, reason: 'invalid_item' });
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.params).toEqual([FILING, OWN]);
  });

  it('a step key must name the same engagement', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    expect(await repo.resolveReminderTarget(ctx('intern'), OWN, `step:${OTHER}:pre-1`)).toEqual({ ok: false, reason: 'invalid_item' });
  });

  it('a step on the engagement resolves to its title and the client page', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    const out = await repo.resolveReminderTarget(ctx('super_admin'), OWN, `step:${OWN}:pre-1`);
    expect(out.ok).toBe(true);
    if (out.ok === true) {
      expect(out.target.engagementDbId).toBe(OWN);
      expect(out.target.clientPath).toContain('/app/client/incorporation');
      expect(out.target.itemTitle.length).toBeGreaterThan(0);
    }
  });

  it('rejects a key that does not parse', async () => {
    expect(await repo.resolveReminderTarget(ctx('admin'), OWN, 'nonsense')).toEqual({ ok: false, reason: 'invalid_item' });
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });
});

describe('lastReminderWithinWindow', () => {
  it('reads the reminder audit rows for this engagement and item inside 24 hours', async () => {
    const at = new Date('2026-10-29T08:00:00Z');
    results = [[{ at }]];
    const now = new Date('2026-10-29T10:00:00Z');
    expect(await repo.lastReminderWithinWindow(ctx('intern'), { engagementDbId: OWN, itemKey: `request:${FILING}` }, now)).toEqual(at);
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.params).toContain(OWN);
    expect(q.params).toContain(repo.REMINDER_AUDIT_ACTION);
    expect(q.params).toContain(`request:${FILING}`);
  });

  it('a client gets null without a query', async () => {
    expect(await repo.lastReminderWithinWindow(ctx('client'), { engagementDbId: OWN, itemKey: 'x' })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('recordReminderDeliveries', () => {
  it('writes one row per send against the scoped engagement', async () => {
    await repo.recordReminderDeliveries(ctx('manager'), { engagementDbId: OWN }, [
      { recipientProfileId: 'p1', channel: 'email', toAddress: 'a@x.in', status: 'sent' },
      { recipientProfileId: 'p1', channel: 'whatsapp', toAddress: null, status: 'skipped', skipReason: 'no_consent' },
    ]);
    const values = calls[0]!.values as Array<{ engagementId: string; eventType: string; channel: string }>;
    expect(values).toHaveLength(2);
    expect(values.every((v) => v.engagementId === OWN && v.eventType === 'client_reminder')).toBe(true);
  });

  it('a client writes nothing', async () => {
    await repo.recordReminderDeliveries(ctx('client'), { engagementDbId: OWN }, [
      { recipientProfileId: 'p1', channel: 'email', toAddress: 'a@x.in', status: 'sent' },
    ]);
    expect(calls).toHaveLength(0);
  });
});
