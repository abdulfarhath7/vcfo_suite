import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { AuthContext } from '@/auth/guards';

/**
 * Client audit (client portal Audit page): client role only, scoped to the
 * caller's own engagement, and each event carries the Result word built from
 * `audit_events.result` (G-28).
 */

type Call = { op: string; where?: SQL };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
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

vi.mock('server-only', () => ({}));
vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const call: Call = { op: 'select' };
      calls.push(call);
      return chain(call);
    },
  },
}));

const getMyEngagement = vi.fn();
const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  getMyEngagement: (...a: unknown[]) => getMyEngagement(...a),
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));

const { listClientAuditEvents, listClientAuditDay, ClientAuditError } = await import('@/db/repositories/client-audit');

const dialect = new PgDialect();
const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const ACTOR = '33333333-3333-3333-3333-333333333303';

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role, clientId: role === 'client' ? 'c1' : undefined };
}

function row(over: Partial<Record<string, unknown>>) {
  return {
    id: '44444444-4444-4444-4444-44444444440' + String(calls.length),
    createdAt: new Date('2026-10-20T08:00:00Z'),
    actorUserId: ACTOR,
    actorRole: 'intern',
    actorEmail: 'lead@sbc.test',
    actorName: 'Arjun Mehta',
    engagementId: OWN,
    action: 'checklist.accept',
    summary: 'Accepted a step',
    metadata: {},
    result: 'ok',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  getMyEngagement.mockResolvedValue({ id: 'own-slug' });
  assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { companyName: 'Northwind India Private Limited' } });
});

describe('listClientAuditEvents — scope', () => {
  it.each(['admin', 'super_admin', 'manager', 'intern'] as const)('%s is refused with 403 and no query', async (role) => {
    await expect(listClientAuditEvents(ctx(role))).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });

  it('a client reads only the own engagement', async () => {
    results = [[row({})], [{ id: ACTOR, name: 'Arjun Mehta' }]];
    await listClientAuditEvents(ctx('client'));
    const q = dialect.sqlToQuery(calls[0]!.where!);
    expect(q.sql).toContain('"audit_events"."engagement_id" =');
    expect(q.params[0]).toBe(OWN);
    expect(q.params).not.toContain(OTHER);
  });

  it('a client whose engagement check fails gets 404 and no audit query', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false });
    await expect(listClientAuditEvents(ctx('client'))).rejects.toBeInstanceOf(ClientAuditError);
    expect(calls).toHaveLength(0);
  });

  it('a client with no engagement gets 404', async () => {
    getMyEngagement.mockResolvedValue(null);
    await expect(listClientAuditDay(ctx('client'), '2026-10-20')).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(0);
  });
});

describe('listClientAuditEvents — Result', () => {
  it('maps audit_events.result and sent-back actions to the Result word', async () => {
    results = [
      [
        row({ id: 'a', action: 'checklist.accept', result: 'ok' }),
        row({ id: 'b', action: 'document_request.sent_back', result: 'ok' }),
        row({ id: 'c', action: 'credentials.reveal', result: 'failed' }),
        row({ id: 'd', action: 'credentials.otp', result: 'denied' }),
      ],
      [],
    ];
    const page = await listClientAuditEvents(ctx('client'));
    expect(page.events.map((e) => e.result)).toEqual(['Done', 'Sent back', 'Failed', 'Denied']);
  });

  it('never returns the actor email', async () => {
    results = [[row({ actorName: 'lead@sbc.test' })], []];
    const page = await listClientAuditEvents(ctx('client'));
    expect(JSON.stringify(page)).not.toContain('lead@sbc.test');
  });
});
