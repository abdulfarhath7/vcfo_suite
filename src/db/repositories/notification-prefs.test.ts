import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * notification_prefs: owner only. Reads and writes are keyed by `ctx.userId`
 * and no caller-supplied id exists; quiet hours start and end are stored
 * (staff Profile, G-25); locked email categories cannot be switched off; the
 * WhatsApp job's system reader falls back to the defaults the page shows.
 */

type Call = { op: string; where?: SQL; values?: Record<string, unknown> };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    limit: () => c,
    onConflictDoUpdate: () => c,
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

const repo = await import('@/db/repositories/notification-prefs');
const dialect = new PgDialect();
const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function ctx(userId = ME): AuthContext {
  return { userId, email: 'me@sbc.in', name: 'Me', role: 'manager' };
}
const params = (c: Call | undefined) => (c?.where ? dialect.sqlToQuery(c.where).params : []);

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('owner-only prefs', () => {
  it('reads only the caller’s row', async () => {
    results = [[]];
    const prefs = await repo.getOwnNotificationPrefs(ctx());
    expect(params(calls[0])).toEqual([ME]);
    expect(prefs.quietStart).toBe('21:00');
  });

  it('gives another person nothing of mine: their read is keyed by their own id', async () => {
    results = [[]];
    await repo.getOwnNotificationPrefs(ctx(OTHER));
    expect(params(calls[0])).toEqual([OTHER]);
  });

  it('stores quiet hours times and refuses to switch off a locked email category', async () => {
    results = [[], []];
    const next = await repo.updateOwnNotificationPrefs(ctx(), {
      quietStart: '22:30',
      quietEnd: '07:15',
      whatsapp: { docs: false },
      email: { docs: false } as never,
    });
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.values?.profileId).toBe(ME);
    expect(insert.values?.quietStart).toBe('22:30');
    expect(insert.values?.quietEnd).toBe('07:15');
    expect(next.whatsapp.docs).toBe(false);
    expect(next.email).not.toHaveProperty('docs');
  });

  it('ignores a malformed time', async () => {
    results = [[], []];
    const next = await repo.updateOwnNotificationPrefs(ctx(), { quietStart: '25:00' });
    expect(next.quietStart).toBe('21:00');
  });
});

describe('systemGetWhatsAppGatePrefs', () => {
  it('returns the defaults with the India time zone when nothing was saved', async () => {
    results = [[]];
    const prefs = await repo.systemGetWhatsAppGatePrefs(ME);
    expect(prefs).toMatchObject({ quietHours: true, quietStart: '21:00', quietEnd: '08:00', tz: 'Asia/Kolkata' });
    expect(params(calls[0])).toEqual([ME]);
  });

  it('refuses a malformed id without reading', async () => {
    expect(await repo.systemGetWhatsAppGatePrefs('nope')).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
