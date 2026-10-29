import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { AuthContext } from '@/auth/guards';
import { devDb } from './dev-test-db';

/**
 * Developer console: audit. Developer and super admin only; the query is always limited to
 * system and access actions (or failed and denied results), client actors are not named and
 * summaries are scrubbed.
 */

vi.mock('@/db/client', async () => (await import('./dev-test-db')).mockDbModule);

const { listAuditForDev, countAuditProblemsForDev, decodeAuditCursor, encodeAuditCursor } = await import('./dev-audit');

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `u-${role}`, email: `${role}@vcfo.local`, name: role, role });
const dialect = new PgDialect();
const when = new Date('2026-10-28T09:00:00Z');
const ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => devDb.reset());

describe('dev audit access', () => {
  it.each(['admin', 'manager', 'intern', 'client'] as const)('refuses %s without a query', async (role) => {
    await expect(listAuditForDev(ctx(role))).rejects.toThrow('not permitted');
    await expect(countAuditProblemsForDev(ctx(role))).rejects.toThrow('not permitted');
    expect(devDb.calls).toHaveLength(0);
  });
});

describe('listAuditForDev', () => {
  it.each(['developer', 'super_admin'] as const)('limits the query to system and access actions for %s', async (role) => {
    devDb.results.push([]);
    await listAuditForDev(ctx(role));
    const q = dialect.sqlToQuery(devDb.calls[0].where!);
    expect(q.sql).toContain('"result" in');
    expect(q.params).toContain('system.%');
    expect(q.params).toContain('auth.%');
    expect(q.params).not.toContain('checklist.%');
  });

  it('hides client actors and scrubs summaries', async () => {
    devDb.results.push([
      { id: ID, createdAt: when, actorRole: 'client', actorName: 'Ravi Client', actorEmail: 'ravi@client.co', action: 'credentials.otp_locked', summary: 'entered 3 wrong codes', result: 'denied' },
      { id: ID, createdAt: when, actorRole: 'admin', actorName: 'Meera', actorEmail: 'meera@sbcllp.in', action: 'account.email_change', summary: 'Changed email to new.lead@sbcllp.in', result: 'ok' },
    ]);
    const out = await listAuditForDev(ctx('developer'));
    expect(out.events[0].actor).toBe('Client');
    expect(out.events[1].summary).toBe('Changed email to n•••@sbcllp.in');
    expect(JSON.stringify(out)).not.toContain('Ravi');
  });

  it('pages with a keyset cursor', async () => {
    devDb.results.push([{ id: ID, createdAt: when, actorRole: 'admin', actorName: 'A', actorEmail: null, action: 'system.x', summary: 's', result: 'ok' }]);
    const out = await listAuditForDev(ctx('developer'), { limit: 1 });
    expect(out.nextBefore).toBe(encodeAuditCursor({ createdAt: when.toISOString(), id: ID }));
    const cursor = decodeAuditCursor(out.nextBefore);
    expect(cursor).toEqual({ createdAt: when, id: ID });

    devDb.results.push([]);
    await listAuditForDev(ctx('developer'), { before: cursor, result: 'failed' });
    const q = dialect.sqlToQuery(devDb.calls.at(-1)!.where!);
    expect(q.params).toContain('failed');
    expect(q.params).toContain(ID);
  });

  it('rejects a malformed cursor', () => {
    expect(decodeAuditCursor('nope')).toBeNull();
    expect(decodeAuditCursor('2026-10-28T09:00:00Z~not-a-uuid')).toBeNull();
  });
});
