import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * Sign-in links (S-650): Microsoft sign-in maps only to an existing, active staff profile and
 * never inserts a profile; a profile linked to another Microsoft subject, a client and a profile
 * with two-step sign-in on are refused; the owner reads and removes only their own link.
 */

type Call = { op: string; table?: unknown; where?: SQL; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    limit: () => c,
    orderBy: () => c,
    onConflictDoNothing: () => c,
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
const op = (name: string) => (table?: unknown) => {
  const call: Call = { op: name, table };
  calls.push(call);
  return chain(call);
};
vi.mock('@/db/client', () => ({ db: { select: op('select'), update: op('update'), insert: op('insert'), delete: op('delete') } }));
vi.mock('server-only', () => ({}));
const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));

const { systemResolveExternalSignIn, getOwnSignInLink, removeOwnSignInLink, MICROSOFT_PROVIDER_ID } = await import(
  '@/db/repositories/sign-in-links'
);
const { profiles, signInLinks } = await import('@/db/schema');
const dialect = new PgDialect();

const ME = '11111111-1111-4111-8111-111111111101';
const profile = {
  id: ME,
  email: 'lead@sbc.test',
  name: 'Lead',
  role: 'manager',
  internId: null,
  clientId: null,
  status: 'active',
  avatarObjectKey: null,
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  totpEnabledAt: null,
  totpSecretEnc: null,
};
const input = { provider: MICROSOFT_PROVIDER_ID, subject: 'ms-sub-1', email: 'Lead@SBC.test', link: true };

beforeEach(() => {
  calls.length = 0;
  results = [];
  recordAuditEvent.mockReset();
});

describe('systemResolveExternalSignIn', () => {
  it('refuses an email with no profile and never inserts a profile', async () => {
    results = [[], []];
    expect(await systemResolveExternalSignIn(input)).toEqual({ ok: false, reason: 'no_profile' });
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('refuses a client and a profile with two-step sign-in on', async () => {
    results = [[], [{ ...profile, role: 'client' }]];
    expect(await systemResolveExternalSignIn(input)).toEqual({ ok: false, reason: 'not_allowed' });
    results = [[], [{ ...profile, totpEnabledAt: new Date(), totpSecretEnc: 'x' }]];
    expect(await systemResolveExternalSignIn(input)).toEqual({ ok: false, reason: 'two_step_on' });
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('refuses a profile already linked to another Microsoft subject', async () => {
    results = [[], [profile], [{ subject: 'ms-sub-other' }]];
    expect(await systemResolveExternalSignIn(input)).toEqual({ ok: false, reason: 'linked_elsewhere' });
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('links an existing profile by lower-cased email, inserting only the link row', async () => {
    results = [[], [profile], [], []];
    const out = await systemResolveExternalSignIn(input);
    expect(out).toMatchObject({ ok: true, profile: { id: ME } });
    const byEmail = calls.filter((c) => c.op === 'select')[1]!;
    expect(dialect.sqlToQuery(byEmail.where!).params).toEqual(['lead@sbc.test']);
    const inserts = calls.filter((c) => c.op === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.table).toBe(signInLinks);
    expect(inserts.some((c) => c.table === profiles)).toBe(false);
    expect(inserts[0]!.set).toMatchObject({ profileId: ME, subject: 'ms-sub-1', email: 'lead@sbc.test' });
  });
});

describe('own link', () => {
  const ctx = { userId: ME, email: 'lead@sbc.test', name: 'Lead', role: 'manager' } as AuthContext;

  it('reads only the caller\'s link', async () => {
    results = [[]];
    expect(await getOwnSignInLink(ctx, MICROSOFT_PROVIDER_ID)).toBeNull();
    expect(dialect.sqlToQuery(calls[0]!.where!).params).toEqual([ME, MICROSOFT_PROVIDER_ID]);
  });

  it('removes only the caller\'s link and audits it', async () => {
    results = [[{ id: 'x' }]];
    expect(await removeOwnSignInLink(ctx, MICROSOFT_PROVIDER_ID)).toBe(true);
    expect(dialect.sqlToQuery(calls[0]!.where!).params).toEqual([ME, MICROSOFT_PROVIDER_ID]);
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
  });
});
