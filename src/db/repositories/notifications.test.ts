import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Notifications are per-user (Path A: `user_id = ctx.userId`), for every role —
 * admin included. Nobody reads, marks, dismisses or restores another user's
 * bell. Only admin / manager may *create* a row for someone else; every other
 * create is forced back to the caller.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    innerJoin: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    values: (v: unknown) => {
      call.values = v;
      return c;
    },
    set: (s: unknown) => {
      call.set = s;
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

const repo = await import('@/db/repositories/notifications');

const dialect = new PgDialect();
function rendered(call: Call | undefined) {
  if (!call?.where) throw new Error('no WHERE captured');
  return dialect.sqlToQuery(call.where);
}

const ROLES: AuthContext['role'][] = ['super_admin', 'admin', 'manager', 'intern', 'client'];
const OTHER_USER = 'user-someone-else';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

function row(userId: string, id = 'n-1') {
  return {
    id,
    userId,
    title: 'Hello',
    description: JSON.stringify({ body: 'b', kind: 'checklist.deliver' }),
    status: 'unread',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    dismissedAt: null,
  };
}

const notif = {
  kind: 'checklist.deliver' as const,
  title: 'T',
  body: 'B',
  engagementId: 'e1',
  companyName: 'Acme',
  href: '#',
};

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('reads are self-scoped for every role', () => {
  it.each(ROLES)('%s inbox filters on own user_id and hides dismissed', async (role) => {
    await repo.listNotifications(ctx(role));
    const q = rendered(calls[0]);
    expect(q.sql).toContain('"notifications"."user_id" = $');
    expect(q.sql).toContain('"notifications"."dismissed_at" is null');
    expect(q.params).toContain(`user-${role}`);
    expect(q.params).not.toContain(OTHER_USER);
  });

  it.each(ROLES)('%s history is still self-scoped', async (role) => {
    await repo.listNotifications(ctx(role), { includeDismissed: true });
    const q = rendered(calls[0]);
    expect(q.sql).toContain('"notifications"."user_id" = $');
    expect(q.sql).not.toContain('dismissed_at');
    expect(q.params).toEqual([`user-${role}`]);
  });

  it.each(ROLES)('%s inbox head is self-scoped', async (role) => {
    results = [[{ id: 'n-2', status: 'unread' }, { id: 'n-1', status: 'read' }]];
    const head = await repo.getNotificationInboxHead(ctx(role));
    expect(head).toEqual({ latestId: 'n-2', unreadCount: 1, count: 2 });
    expect(rendered(calls[0]).params).toContain(`user-${role}`);
  });
});

describe('create', () => {
  it.each(['admin', 'manager'] as const)('%s may target another user', async (role) => {
    results = [[row(OTHER_USER)]];
    await repo.createNotification(ctx(role), { ...notif, userId: OTHER_USER });
    expect((calls[0]!.values as { userId: string }).userId).toBe(OTHER_USER);
  });

  it.each(['intern', 'client'] as const)(
    '%s targeting another user is forced back to self',
    async (role) => {
      results = [[row(`user-${role}`)]];
      await repo.createNotification(ctx(role), { ...notif, userId: OTHER_USER });
      expect((calls[0]!.values as { userId: string }).userId).toBe(`user-${role}`);
    },
  );

  it('bulk create always writes to the caller, even for admin', async () => {
    results = [[row('user-admin')]];
    await repo.createNotifications(ctx('admin'), [notif, notif]);
    const values = calls[0]!.values as Array<{ userId: string }>;
    expect(values.map((v) => v.userId)).toEqual(['user-admin', 'user-admin']);
  });
});

describe('mutations never touch another user’s rows', () => {
  it.each(ROLES)('%s mark-read is keyed on id AND own user_id', async (role) => {
    results = [[]]; // the id belongs to someone else: no row matched
    const out = await repo.markNotificationRead(ctx(role), 'n-of-other');
    expect(out).toBeNull();
    const q = rendered(calls[0]);
    expect(q.sql).toContain('"notifications"."user_id" = $');
    expect(q.params).toEqual(expect.arrayContaining(['n-of-other', `user-${role}`]));
  });

  it.each(ROLES)('%s mark-all-read is self-scoped', async (role) => {
    results = [[{ id: 'a' }, { id: 'b' }]];
    expect(await repo.markAllNotificationsRead(ctx(role))).toBe(2);
    expect(rendered(calls[0]).params).toContain(`user-${role}`);
  });

  it.each(ROLES)('%s dismiss ignores ids outside own user_id', async (role) => {
    results = [[]];
    await repo.dismissNotifications(ctx(role), ['n-own', 'n-of-other']);
    const q = rendered(calls[0]);
    expect(q.sql).toContain('"notifications"."user_id" = $');
    expect(q.params).toEqual(expect.arrayContaining([`user-${role}`, 'n-own', 'n-of-other']));
    expect(calls.some((c) => c.op === 'delete')).toBe(false);
  });

  it.each(ROLES)('%s restore is self-scoped', async (role) => {
    results = [[]];
    await repo.restoreNotifications(ctx(role), ['n-of-other']);
    const q = rendered(calls[0]);
    expect(q.sql).toContain('"notifications"."user_id" = $');
    expect(q.params).toContain(`user-${role}`);
  });

  it('empty dismiss / restore batches issue no query', async () => {
    expect(await repo.dismissNotifications(ctx('client'), [])).toEqual([]);
    expect(await repo.restoreNotifications(ctx('client'), [])).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
