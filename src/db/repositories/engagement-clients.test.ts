import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for engagement client membership.
 *
 * Every ctx-taking function gates on `assertEngagementAccess` (the engagements
 * RLS row) and must then work only against the id it approved — never the raw
 * id the caller sent. A caller who fails the gate gets "not found or not
 * permitted" with no read, write or audit. Substitution additionally refuses
 * to touch a user who is not on this project, and a client who is not
 * themselves on the project.
 */

const assertEngagementAccess = vi.fn();
const recordAuditEvent = vi.fn();

const wheres: SQL[] = [];
/** Each awaited select pops the next result set. */
let selectQueue: unknown[][] = [];
const writes: string[] = [];

function selectChain(): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    innerJoin: () => c,
    where: (w: SQL) => {
      wheres.push(w);
      return c;
    },
    limit: () => c,
    orderBy: () => c,
    then: (resolve: (v: unknown[]) => unknown) => resolve(selectQueue.shift() ?? []),
  };
  return c;
}

function writeChain(kind: string): unknown {
  writes.push(kind);
  const c: Record<string, unknown> = {
    set: () => c,
    values: () => c,
    where: () => c,
    returning: () => c,
    onConflictDoNothing: () => c,
    then: (resolve: (v: unknown[]) => unknown) => resolve([]),
  };
  return c;
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => selectChain(),
    insert: () => writeChain('insert'),
    update: () => writeChain('update'),
    delete: () => writeChain('delete'),
    transaction: vi.fn(async () => {
      writes.push('transaction');
    }),
  },
}));

vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));

const repo = await import('@/db/repositories/engagement-clients');

const dialect = new PgDialect();
const render = (w: SQL) => dialect.sqlToQuery(w);

const OWN = '11111111-1111-1111-1111-111111111101'; // seeded legacy id "e1"
const OTHER = '22222222-2222-2222-2222-222222222202';

function ctx(role: AuthContext['role'], userId = `user-${role}`): AuthContext {
  return { userId, email: `${userId}@vcfo.local`, name: userId, role };
}

const forbidden = { ok: false, dbId: OTHER, forbidden: true };
const notFound = { ok: false, dbId: OTHER, notFound: true };

beforeEach(() => {
  vi.clearAllMocks();
  wheres.length = 0;
  writes.length = 0;
  selectQueue = [];
});

describe('listClientMemberEngagementIds', () => {
  it('filters by the given user only', async () => {
    selectQueue = [[{ engagementId: OWN }]];
    await expect(repo.listClientMemberEngagementIds('user-a')).resolves.toEqual([OWN]);
    const q = render(wheres[0]!);
    expect(q.sql).toBe('"engagement_clients"."user_id" = $1');
    expect(q.params).toEqual(['user-a']);
  });
});

describe('listEngagementClients', () => {
  it.each([
    ['forbidden', forbidden],
    ['not found', notFound],
  ])('throws on %s without reading members', async (_l, result) => {
    assertEngagementAccess.mockResolvedValue(result);
    await expect(repo.listEngagementClients(ctx('client'), OTHER)).rejects.toThrow(
      /not found or not permitted/,
    );
    expect(wheres).toHaveLength(0);
  });

  it('reads members of the approved db id, not the raw id sent', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    await repo.listEngagementClients(ctx('client'), 'e1');
    expect(assertEngagementAccess).toHaveBeenCalledWith(expect.objectContaining({ role: 'client' }), 'e1');
    const q = render(wheres[0]!);
    expect(q.sql).toBe('"engagement_clients"."engagement_id" = $1');
    expect(q.params).toEqual([OWN]);
  });
});

describe('inviteEngagementClient', () => {
  const input = { engagementId: OTHER, email: 'peer@acme.test', password: 'password123' };

  it.each(['client', 'intern', 'manager', 'admin', 'super_admin'] as const)(
    '%s cannot invite onto an engagement outside their scope',
    async (role) => {
      assertEngagementAccess.mockResolvedValue(forbidden);
      await expect(repo.inviteEngagementClient(ctx(role), input)).rejects.toThrow(
        /not found or not permitted/,
      );
      expect(wheres).toHaveLength(0);
      expect(writes).toEqual([]);
      expect(recordAuditEvent).not.toHaveBeenCalled();
    },
  );

  it('refuses to attach a staff account as a client', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    selectQueue = [
      [{ id: OWN, clientId: 'c-a', clientUserId: null, companyName: 'Acme' }],
      [{ id: 'user-staff', role: 'manager', status: 'active', clientId: null }],
    ];
    await expect(
      repo.inviteEngagementClient(ctx('client'), { ...input, engagementId: OWN }),
    ).rejects.toThrow('email_not_a_client');
    expect(writes).toEqual([]);
  });

  it('writes membership and audit against the approved engagement', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    selectQueue = [
      [{ id: OWN, clientId: 'c-a', clientUserId: null, companyName: 'Acme' }],
      [{ id: 'user-peer', role: 'client', status: 'active', clientId: 'c-a', name: 'Peer' }],
      [], // not already a member
    ];
    const out = await repo.inviteEngagementClient(ctx('client', 'user-client-a'), {
      ...input,
      engagementId: 'e1',
    });
    expect(out.userId).toBe('user-peer');
    // eng lookup, profile lookup, membership check — all against OWN where an engagement is named.
    expect(render(wheres[0]!).params).toEqual([OWN]);
    expect(render(wheres[2]!).params).toEqual([OWN, 'user-peer']);
    expect(writes).toEqual(['insert']);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-client-a' }),
      expect.objectContaining({ engagementId: 'e1', action: 'client.invite' }),
    );
  });
});

describe('substituteEngagementClient', () => {
  const input = {
    engagementId: OWN,
    replaceUserId: 'user-client-a',
    email: 'new@acme.test',
    password: 'password123',
  };

  it('outside scope: refused before any read or write', async () => {
    assertEngagementAccess.mockResolvedValue(forbidden);
    await expect(
      repo.substituteEngagementClient(ctx('manager'), { ...input, engagementId: OTHER }),
    ).rejects.toThrow(/not found or not permitted/);
    expect(wheres).toHaveLength(0);
    expect(writes).toEqual([]);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('cannot remove a user who is not on this project (e.g. another tenant’s client)', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    selectQueue = [
      [{ id: OWN, clientId: 'c-a', clientUserId: null, companyName: 'Acme' }],
      [{ userId: 'user-client-a', memberRole: 'owner', email: 'a@acme.test', name: 'A' }],
    ];
    await expect(
      repo.substituteEngagementClient(ctx('admin'), { ...input, replaceUserId: 'user-client-b' }),
    ).rejects.toThrow('replace_user_not_on_project');
    expect(writes).toEqual([]);
  });

  it('a client who passes the access check but is not on the project is refused', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: {} });
    selectQueue = [
      [{ id: OWN, clientId: 'c-a', clientUserId: null, companyName: 'Acme' }],
      [{ userId: 'user-client-a', memberRole: 'owner', email: 'a@acme.test', name: 'A' }],
    ];
    await expect(
      repo.substituteEngagementClient(ctx('client', 'user-outsider'), input),
    ).rejects.toThrow(/Not permitted to substitute/);
    expect(writes).toEqual([]);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
