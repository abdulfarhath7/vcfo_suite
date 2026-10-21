import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * audit_events (README table, ported RLS + product override):
 *   admin / super_admin — read all
 *   manager — owned/assigned engagements only; unscoped rows dropped
 *   intern  — actor_user_id = self OR assigned engagements
 *   client  — own engagements
 * Insert: any authenticated user; actor_user_id forced to the session user.
 */

type Call = { op: string; where?: SQL; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];
let insertThrows = false;

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    orderBy: () => c,
    limit: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    values: (v: unknown) => {
      call.values = v;
      if (insertThrows) return Promise.reject(new Error('db down'));
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
  db: { select: op('select'), insert: op('insert') },
}));

const listScopedEngagementIds = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
}));

const { recordAuditEvent, listAuditEvents } = await import('@/db/repositories/audit-events');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role']): AuthContext {
  return {
    userId: `user-${role}`,
    email: `${role}@vcfo.local`,
    name: role,
    role,
    internId: role === 'intern' ? 'i1' : undefined,
    clientId: role === 'client' ? 'c1' : undefined,
  };
}

function where() {
  const w = calls.at(-1)?.where;
  return w ? dialect.sqlToQuery(w) : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  insertThrows = false;
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('listAuditEvents — firm-wide roles', () => {
  it.each(['admin', 'super_admin'] as const)('%s reads with no scope predicate', async (role) => {
    await listAuditEvents(ctx(role));
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.where).toBeUndefined();
  });

  it.each(['admin', 'super_admin'] as const)(
    '%s may filter to any engagement without a scope check',
    async (role) => {
      await listAuditEvents(ctx(role), { engagementId: OTHER });
      expect(listScopedEngagementIds).not.toHaveBeenCalled();
      expect(where()!.params).toEqual([OTHER]);
    },
  );
});

describe('listAuditEvents — manager and client', () => {
  it.each(['manager', 'client'] as const)('%s is limited to scoped engagements', async (role) => {
    await listAuditEvents(ctx(role));
    const q = where()!;
    expect(q.sql).toContain('"audit_events"."engagement_id" in');
    expect(q.sql).not.toContain('actor_user_id');
    expect(q.params).toEqual([OWN]);
  });

  it.each(['manager', 'client'] as const)(
    '%s with no engagements gets [] and no query',
    async (role) => {
      listScopedEngagementIds.mockResolvedValue([]);
      expect(await listAuditEvents(ctx(role))).toEqual([]);
      expect(calls).toHaveLength(0);
    },
  );

  it.each(['manager', 'intern', 'client'] as const)(
    '%s asking for another firm’s engagement gets [] and no query',
    async (role) => {
      expect(await listAuditEvents(ctx(role), { engagementId: OTHER })).toEqual([]);
      expect(calls).toHaveLength(0);
    },
  );

  it('an in-scope engagement filter narrows to that engagement', async () => {
    await listAuditEvents(ctx('client'), { engagementId: OWN });
    expect(where()!.params).toEqual([OWN]);
  });
});

describe('listAuditEvents — intern (Project Lead)', () => {
  it('sees own-actor rows OR assigned engagements', async () => {
    await listAuditEvents(ctx('intern'));
    const q = where()!;
    expect(q.sql).toContain('"audit_events"."actor_user_id" = $');
    expect(q.sql).toContain(' or ');
    expect(q.params).toEqual(['user-intern', OWN]);
  });

  it('with no assignments still sees only its own actor rows', async () => {
    listScopedEngagementIds.mockResolvedValue([]);
    await listAuditEvents(ctx('intern'));
    const q = where()!;
    expect(q.sql).not.toContain('engagement_id');
    expect(q.params).toEqual(['user-intern']);
  });
});

describe('recordAuditEvent', () => {
  it('forces actor id / role to the session user', async () => {
    await recordAuditEvent(ctx('client'), {
      engagementId: OWN,
      action: 'x',
      summary: 'y',
    });
    const v = calls[0]!.values as { actorUserId: string; actorRole: string; engagementId: string };
    expect(v.actorUserId).toBe('user-client');
    expect(v.actorRole).toBe('client');
    expect(v.engagementId).toBe(OWN);
  });

  it('never throws to the caller when the write fails', async () => {
    insertThrows = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      recordAuditEvent(ctx('manager'), { action: 'x', summary: 'y' }),
    ).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
