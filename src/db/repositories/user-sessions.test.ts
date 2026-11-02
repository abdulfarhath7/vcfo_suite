import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * user_sessions (G-25): owner only. A person lists and revokes only their own
 * devices; "everywhere else" keeps the current device; a revoked or foreign
 * row fails the session check; last seen is throttled to five minutes.
 */

type Call = { op: string; table?: unknown; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: (t: unknown) => {
      call.table = t;
      return c;
    },
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
    set: (v: unknown) => {
      call.set = v;
      return c;
    },
    values: (v: unknown) => {
      call.values = v;
      return c;
    },
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}
function op(name: string) {
  return (table?: unknown) => {
    const call: Call = { op: name, table };
    calls.push(call);
    return chain(call);
  };
}

vi.mock('@/db/client', () => ({
  db: { select: op('select'), insert: op('insert'), update: op('update') },
}));
const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));

const repo = await import('@/db/repositories/user-sessions');
const { profiles, userSessions } = await import('@/db/schema');

const dialect = new PgDialect();
const ME = '11111111-1111-4111-8111-111111111111';
const OTHER_PERSON = '22222222-2222-4222-8222-222222222222';
const THIS_DEVICE = '33333333-3333-4333-8333-333333333333';
const OTHER_DEVICE = '44444444-4444-4444-8444-444444444444';

function ctx(patch: Partial<AuthContext> = {}): AuthContext {
  return { userId: ME, email: 'me@sbc.in', name: 'Me', role: 'manager', sessionId: THIS_DEVICE, ...patch };
}

function sql(call: Call | undefined) {
  return call?.where ? dialect.sqlToQuery(call.where) : null;
}

beforeEach(() => {
  calls.length = 0;
  results = [];
  recordAuditEvent.mockReset();
  repo.resetLastSeenThrottle();
});

describe('listOwnSessions', () => {
  it('reads only the caller’s live rows and marks this device', async () => {
    const now = new Date('2026-10-29T06:00:00Z');
    results = [
      [
        { id: THIS_DEVICE, userAgent: 'UA', ip: '1.2.3.4', createdAt: now, lastSeenAt: now },
        { id: OTHER_DEVICE, userAgent: null, ip: null, createdAt: now, lastSeenAt: now },
      ],
    ];
    const rows = await repo.listOwnSessions(ctx(), now);
    const q = sql(calls[0])!;
    expect(q.params).toContain(ME);
    expect(q.params).not.toContain(OTHER_PERSON);
    expect(q.sql).toContain('"revoked_at" is null');
    expect(rows.map((r) => r.current)).toEqual([true, false]);
  });

  it('marks nothing as this device for a token issued before devices were tracked', async () => {
    const now = new Date();
    results = [[{ id: THIS_DEVICE, userAgent: null, ip: null, createdAt: now, lastSeenAt: now }]];
    const rows = await repo.listOwnSessions(ctx({ sessionId: undefined }), now);
    expect(rows[0].current).toBe(false);
  });
});

describe('revokeOwnSession', () => {
  it('scopes the update to the caller and audits it', async () => {
    results = [[{ id: OTHER_DEVICE }]];
    expect(await repo.revokeOwnSession(ctx(), OTHER_DEVICE)).toBe(true);
    const q = sql(calls[0])!;
    expect(calls[0].table).toBe(userSessions);
    expect(q.params).toEqual(expect.arrayContaining([OTHER_DEVICE, ME]));
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'account.session_revoked' }));
  });

  it('gives a person outside the scope nothing: another person’s row matches no row', async () => {
    results = [[]];
    expect(await repo.revokeOwnSession(ctx({ userId: OTHER_PERSON }), OTHER_DEVICE)).toBe(false);
    expect(sql(calls[0])!.params).toContain(OTHER_PERSON);
    expect(sql(calls[0])!.params).not.toContain(ME);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('refuses a malformed id without touching the database', async () => {
    expect(await repo.revokeOwnSession(ctx(), 'nope')).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('revokeOwnOtherSessions', () => {
  it('keeps the current device', async () => {
    results = [[{ id: OTHER_DEVICE }]];
    expect(await repo.revokeOwnOtherSessions(ctx())).toBe(1);
    const q = sql(calls[0])!;
    expect(q.sql).toContain('<>');
    expect(q.params).toEqual(expect.arrayContaining([ME, THIS_DEVICE]));
  });
});

describe('systemIsSessionActive', () => {
  it('needs the row id and the owner together', async () => {
    results = [[{ id: THIS_DEVICE }]];
    expect(await repo.systemIsSessionActive(THIS_DEVICE, ME)).toBe(true);
    expect(sql(calls[0])!.params).toEqual(expect.arrayContaining([THIS_DEVICE, ME]));
    results = [[]];
    expect(await repo.systemIsSessionActive(THIS_DEVICE, OTHER_PERSON)).toBe(false);
    expect(await repo.systemIsSessionActive('bad', ME)).toBe(false);
  });
});

describe('systemTouchLastSeen', () => {
  it('writes the profile and the device, then waits five minutes', async () => {
    const t0 = new Date('2026-10-29T06:00:00Z');
    await repo.systemTouchLastSeen(ME, THIS_DEVICE, t0);
    expect(calls.map((c) => c.table)).toEqual([profiles, userSessions]);
    expect(calls[0].set).toEqual({ lastSeenAt: t0 });
    expect(calls[0].set).not.toHaveProperty('updatedAt');
    await repo.systemTouchLastSeen(ME, THIS_DEVICE, new Date(t0.getTime() + 4 * 60_000));
    expect(calls).toHaveLength(2);
    await repo.systemTouchLastSeen(ME, THIS_DEVICE, new Date(t0.getTime() + 6 * 60_000));
    expect(calls).toHaveLength(4);
  });

  it('writes only the profile for a token without a device id', async () => {
    await repo.systemTouchLastSeen(ME, undefined, new Date());
    expect(calls.map((c) => c.table)).toEqual([profiles]);
  });
});

describe('systemCreateUserSession', () => {
  it('stores the user agent and IP, clipped', async () => {
    results = [[{ id: THIS_DEVICE }]];
    const id = await repo.systemCreateUserSession({ userId: ME, userAgent: 'x'.repeat(500), ip: '1.2.3.4' });
    expect(id).toBe(THIS_DEVICE);
    const v = calls[0].values as { userId: string; userAgent: string; ip: string };
    expect(v.userId).toBe(ME);
    expect(v.userAgent).toHaveLength(400);
    expect(v.ip).toBe('1.2.3.4');
  });
});
