import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Client messages (Path A, engagement scope):
 *   client — own engagements only
 *   intern — engagements they lead; manager — engagements they own or co-manage
 *   admin / super_admin — every engagement
 *   developer — nothing
 * Writes and triage go through `assertEngagementAccess`; a foreign engagement makes no write.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    innerJoin: () => c,
    leftJoin: () => c,
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

const repo = await import('@/db/repositories/client-messages');

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
  };
}

function messageRow(engagementId: string, over: Record<string, unknown> = {}) {
  return {
    id: 'm-1',
    engagementId,
    senderId: 'user-client',
    senderSide: 'client',
    body: 'Hello',
    itemKey: null,
    readAt: null,
    triage: 'new',
    triagedBy: null,
    triagedAt: null,
    createdAt: new Date('2026-10-20T10:00:00Z'),
    ...over,
  };
}

function joined(engagementId: string, over: Record<string, unknown> = {}) {
  return { message: messageRow(engagementId, over), companyName: 'Acme', senderName: 'Client', senderEmail: 'c@x.in' };
}

const writes = () => calls.filter((c) => c.op !== 'select');
const denied = { ok: false, dbId: OTHER, forbidden: true };
const allowed = { ok: true, dbId: OWN, row: { companyName: 'Acme' } };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('listStaffMessages', () => {
  it.each(['admin', 'super_admin'] as const)('%s lists firm-wide without a scope lookup', async (role) => {
    results = [[joined(OWN), joined(OTHER, { id: 'm-2' })]];
    expect(await repo.listStaffMessages(ctx(role), { triage: 'new' })).toHaveLength(2);
    expect(listScopedEngagementIds).not.toHaveBeenCalled();
  });

  it.each(['manager', 'intern'] as const)('%s only reads its scoped engagements', async (role) => {
    await repo.listStaffMessages(ctx(role), { triage: 'todo' });
    expect(listScopedEngagementIds).toHaveBeenCalledWith(ctx(role));
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.sql).toContain('"client_messages"."engagement_id" in');
    expect(q.params).toContain(OWN);
    expect(q.params).not.toContain(OTHER);
    expect(q.params).toContain('todo');
  });

  it.each(['manager', 'intern'] as const)('%s with no engagements gets [] and no query', async (role) => {
    listScopedEngagementIds.mockResolvedValue([]);
    expect(await repo.listStaffMessages(ctx(role))).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it.each(['client', 'developer'] as const)('%s gets nothing from the staff list', async (role) => {
    expect(await repo.listStaffMessages(ctx(role))).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it.each(['manager', 'intern'] as const)('%s asking for another firm’s thread gets [] and marks nothing read', async (role) => {
    assertEngagementAccess.mockResolvedValue(denied);
    expect(await repo.listStaffMessages(ctx(role), { engagementId: OTHER })).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('listClientThread', () => {
  it('a client cannot read another firm’s thread', async () => {
    assertEngagementAccess.mockResolvedValue(denied);
    expect(await repo.listClientThread(ctx('client'), OTHER)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('marks staff messages read on the approved engagement, then lists it oldest first', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [[], [joined(OWN, { senderSide: 'staff' })]];
    const out = await repo.listClientThread(ctx('client'), 'e1');
    expect(out).toHaveLength(1);
    expect(calls[0]!.op).toBe('update');
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.params).toContain(OWN);
    expect(q.params).toContain('staff');
  });

  it.each(['intern', 'manager', 'admin'] as const)('%s cannot use the client thread', async (role) => {
    expect(await repo.listClientThread(ctx(role), OWN)).toBeNull();
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });
});

describe('postClientMessage', () => {
  it('a client cannot write on another firm’s engagement', async () => {
    assertEngagementAccess.mockResolvedValue(denied);
    expect(await repo.postClientMessage(ctx('client'), { engagementId: OTHER, body: 'Hi' })).toBeNull();
    expect(writes()).toHaveLength(0);
  });

  it('writes against the approved engagement id as the client side', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [[messageRow(OWN)]];
    const out = await repo.postClientMessage(ctx('client'), { engagementId: 'e1', body: ' Hi ' });
    const values = calls[0]!.values as { engagementId: string; senderSide: string; body: string; senderId: string };
    expect(values).toMatchObject({ engagementId: OWN, senderSide: 'client', body: 'Hi', senderId: 'user-client' });
    expect(out?.companyName).toBe('Acme');
  });

  it('staff cannot post as the client', async () => {
    expect(await repo.postClientMessage(ctx('intern'), { engagementId: OWN, body: 'Hi' })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('setMessageTriage', () => {
  it.each(['manager', 'intern'] as const)('%s cannot triage a message on another firm’s engagement', async (role) => {
    results = [[messageRow(OTHER)]];
    assertEngagementAccess.mockResolvedValue(denied);
    expect(await repo.setMessageTriage(ctx(role), 'm-1', 'done')).toBeNull();
    expect(writes()).toHaveLength(0);
  });

  it('a client cannot triage', async () => {
    expect(await repo.setMessageTriage(ctx('client'), 'm-1', 'done')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('refuses to triage a staff message', async () => {
    results = [[messageRow(OWN, { senderSide: 'staff' })]];
    assertEngagementAccess.mockResolvedValue(allowed);
    await expect(repo.setMessageTriage(ctx('intern'), 'm-1', 'done')).rejects.toThrow(/only client messages/i);
    expect(writes()).toHaveLength(0);
  });

  it('records who triaged it', async () => {
    results = [[messageRow(OWN)], [], [joined(OWN, { triage: 'todo' })]];
    assertEngagementAccess.mockResolvedValue(allowed);
    const out = await repo.setMessageTriage(ctx('intern'), 'm-1', 'todo');
    expect(calls[1]!.set).toMatchObject({ triage: 'todo', triagedBy: 'user-intern' });
    expect(out?.triage).toBe('todo');
  });
});

describe('postStaffMessage', () => {
  it.each(['manager', 'intern'] as const)('%s cannot reply on another firm’s engagement', async (role) => {
    assertEngagementAccess.mockResolvedValue(denied);
    expect(await repo.postStaffMessage(ctx(role), { engagementId: OTHER, body: 'Hi' })).toBeNull();
    expect(writes()).toHaveLength(0);
  });

  it('a client cannot post a staff reply', async () => {
    expect(await repo.postStaffMessage(ctx('client'), { engagementId: OWN, body: 'Hi' })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('writes the staff side against the approved engagement id', async () => {
    assertEngagementAccess.mockResolvedValue(allowed);
    results = [[messageRow(OWN, { senderSide: 'staff', senderId: 'user-manager' })]];
    const out = await repo.postStaffMessage(ctx('manager'), { engagementId: 'e1', body: 'On it' });
    expect(calls[0]!.values).toMatchObject({ engagementId: OWN, senderSide: 'staff', senderId: 'user-manager' });
    expect(out?.senderSide).toBe('staff');
  });

  it('refuses an empty body before any query', async () => {
    await expect(repo.postStaffMessage(ctx('manager'), { engagementId: OWN, body: '   ' })).rejects.toThrow(/body_required/);
    expect(calls).toHaveLength(0);
  });
});
