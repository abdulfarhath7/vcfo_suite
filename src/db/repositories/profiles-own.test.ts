import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * Own profile (P-617): designation and membership number are read and written only on the
 * caller's own row, staff and the developer may set them, and a client's values are ignored.
 */

type Call = { op: string; where?: SQL; set?: Record<string, unknown> };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    limit: () => c,
    returning: () => c,
    set: (v: Record<string, unknown>) => {
      call.set = v;
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
function op(name: string) {
  return () => {
    const call: Call = { op: name };
    calls.push(call);
    return chain(call);
  };
}

vi.mock('@/db/client', () => ({ db: { select: op('select'), insert: op('insert'), update: op('update') } }));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn() }));
vi.mock('@/db/repositories/notification-prefs', () => ({ systemGetWhatsAppGatePrefs: vi.fn() }));

const repo = await import('@/db/repositories/profiles');
const dialect = new PgDialect();
const ME = '11111111-1111-4111-8111-111111111111';
const params = (c: Call | undefined) => (c?.where ? dialect.sqlToQuery(c.where).params : []);
const ctx = (role: AuthContext['role']): AuthContext => ({ userId: ME, email: 'me@sbc.in', name: 'Me', role });
const row = (role: string) => ({ id: ME, email: 'me@sbc.in', passwordHash: null, phoneE164: null, whatsappOptInAt: null, role });

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe('own profile: designation and membership number', () => {
  it('reads them from the caller’s own row', async () => {
    results = [[{ id: ME, name: 'Me', email: 'me@sbc.in', role: 'manager', designation: 'Senior manager', membershipNo: 'A123456', updatedAt: new Date() }]];
    const p = await repo.getOwnProfile(ctx('manager'));
    expect(params(calls[0])).toEqual([ME]);
    expect(p.designation).toBe('Senior manager');
    expect(p.membershipNo).toBe('A123456');
  });

  it('writes them on the caller’s row for staff, trimmed and the number in capitals', async () => {
    results = [[row('manager')], [{ name: 'Me', email: 'me@sbc.in', phone: null, designation: 'Manager', membershipNo: 'A123456' }]];
    await repo.updateOwnProfile(ctx('manager'), { name: 'Me', designation: ' Manager ', membershipNo: 'a123456' });
    const update = calls.find((c) => c.op === 'update')!;
    expect(params(update)).toEqual([ME]);
    expect(update.set).toMatchObject({ designation: 'Manager', membershipNo: 'A123456' });
  });

  it('clears them with an empty value and leaves them alone when omitted', async () => {
    results = [[row('developer')], [{ name: 'Me', email: 'me@sbc.in', phone: null }]];
    await repo.updateOwnProfile(ctx('developer'), { name: 'Me', designation: '' });
    const update = calls.find((c) => c.op === 'update')!;
    expect(update.set?.designation).toBeNull();
    expect(update.set).not.toHaveProperty('membershipNo');
  });

  it('ignores them for a client', async () => {
    results = [[row('client')], [{ name: 'Me', email: 'me@sbc.in', phone: null }]];
    await repo.updateOwnProfile(ctx('client'), { name: 'Me', designation: 'Director', membershipNo: 'X1' });
    const update = calls.find((c) => c.op === 'update')!;
    expect(update.set).not.toHaveProperty('designation');
    expect(update.set).not.toHaveProperty('membershipNo');
  });
});
