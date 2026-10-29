import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

/**
 * weekly digest: the system reader lists only active people whose digest is on (never saved
 * counts as on, the Settings default), never a developer, a removed person or an intern
 * without an intern id; each comes back as the AuthContext their own sign-in would get. The
 * delivery log is keyed by ISO week so a person never gets two digests in one week.
 */

type Call = { op: string; where?: SQL; values?: Record<string, unknown> };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    limit: () => c,
    values: (v: Record<string, unknown>) => {
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
  return () => {
    const call: Call = { op: name };
    calls.push(call);
    return chain(call);
  };
}
vi.mock('@/db/client', () => ({ db: { select: op('select'), insert: op('insert') } }));

const repo = await import('@/db/repositories/weekly-digest');
const dialect = new PgDialect();
const sqlOf = (c: Call | undefined) => (c?.where ? dialect.sqlToQuery(c.where) : { sql: '', params: [] });

const id = (n: number) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;

function row(n: number, over: Record<string, unknown> = {}) {
  return {
    id: id(n),
    email: `p${n}@sbc.in`,
    name: `Person ${n}`,
    role: 'manager',
    internId: null,
    clientId: null,
    status: 'active',
    removedAt: null,
    prefsEmail: null,
    ...over,
  };
}

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('systemListWeeklyDigestRecipients', () => {
  it('asks the database for active, not removed people in the five digest roles only', async () => {
    results = [[]];
    await repo.systemListWeeklyDigestRecipients();
    const q = sqlOf(calls[0]);
    expect(q.sql).toContain('"profiles"."status" = $1');
    expect(q.sql).toContain('"profiles"."removed_at" is null');
    expect(q.params).toEqual(['active', 'super_admin', 'admin', 'manager', 'intern', 'client']);
    expect(q.params).not.toContain('developer');
  });

  it('keeps only opted-in active people and leaves developers out', async () => {
    results = [
      [
        row(1), // never saved prefs: the Settings default is on
        row(2, { prefsEmail: { weeklyDigest: true, announcements: false } }),
        row(3, { prefsEmail: { weeklyDigest: false } }), // switched off
        row(4, { role: 'developer' }),
        row(5, { status: 'suspended' }),
        row(6, { removedAt: new Date('2026-10-01') }),
        row(7, { role: 'intern', internId: null }), // a lead with no intern id cannot sign in
        row(8, { role: 'intern', internId: 'i-8' }),
        row(9, { role: 'client', clientId: 'c-9', prefsEmail: { weeklyDigest: 'yes' } }), // not a boolean: default
        row(10, { email: '  ' }),
      ],
    ];
    const out = await repo.systemListWeeklyDigestRecipients();
    expect(out.map((p) => p.userId)).toEqual([id(1), id(2), id(8), id(9)]);
    expect(out.find((p) => p.userId === id(8))).toMatchObject({ role: 'intern', internId: 'i-8' });
    expect(out.find((p) => p.userId === id(9))).toMatchObject({ role: 'client', clientId: 'c-9', email: 'p9@sbc.in' });
  });

  it('builds each context from the profile row and nothing else', async () => {
    results = [[row(1, { role: 'super_admin', name: '  ' })]];
    const [ctx] = await repo.systemListWeeklyDigestRecipients();
    expect(ctx).toEqual({ userId: id(1), email: 'p1@sbc.in', name: 'p1', role: 'super_admin', internId: undefined, clientId: undefined });
  });
});

describe('weeklyDigestOn', () => {
  it('follows the stored switch and falls back to on', () => {
    expect(repo.weeklyDigestOn(null)).toBe(true);
    expect(repo.weeklyDigestOn({})).toBe(true);
    expect(repo.weeklyDigestOn({ weeklyDigest: false })).toBe(false);
  });
});

describe('the delivery log', () => {
  it('reads sent and skipped digest rows for one ISO week', async () => {
    results = [[{ id: id(1) }, { id: id(1) }, { id: null }, { id: id(2) }]];
    const ids = await repo.systemListDigestRecordedProfileIds('2026-W45');
    expect(ids).toEqual([id(1), id(2)]);
    const q = sqlOf(calls[0]);
    expect(q.params).toEqual(['weekly_digest', 'email', '2026-W45', 'sent', 'skipped']);
    expect(q.params).not.toContain('failed');
  });

  it('refuses a malformed week key without a query', async () => {
    expect(await repo.systemListDigestRecordedProfileIds('last week')).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('writes one email row keyed by the week', async () => {
    results = [[]];
    const ok = await repo.systemRecordDigestDelivery({
      profileId: id(1),
      toAddress: 'p1@sbc.in',
      status: 'skipped',
      skipReason: 'empty',
      weekKey: '2026-W45',
    });
    expect(ok).toBe(true);
    expect(calls[0]!.op).toBe('insert');
    expect(calls[0]!.values).toMatchObject({
      engagementId: null,
      recipientProfileId: id(1),
      eventType: 'weekly_digest',
      channel: 'email',
      templateSid: '2026-W45',
      status: 'skipped',
      skipReason: 'empty',
    });
  });

  it('writes nothing for a profile id that is not a uuid', async () => {
    expect(await repo.systemRecordDigestDelivery({ profileId: 'nope', toAddress: '', status: 'sent', weekKey: '2026-W45' })).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
