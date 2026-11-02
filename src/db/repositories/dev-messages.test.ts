import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { AuthContext } from '@/auth/guards';
import { devDb } from './dev-test-db';

/**
 * Developer console: message logs. Only the developer and the super admin may read them,
 * and a recipient address never leaves the repository unmasked.
 */

vi.mock('@/db/client', async () => (await import('./dev-test-db')).mockDbModule);

const { listDeliveriesForDev, listEmailLogForDev, listMessagesForDev, messageCounts24h } = await import('./dev-messages');

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `u-${role}`, email: `${role}@vcfo.local`, name: role, role });
const dialect = new PgDialect();
const when = new Date('2026-10-28T09:00:00Z');

beforeEach(() => devDb.reset());

describe('dev messages access', () => {
  it.each(['admin', 'manager', 'intern', 'client'] as const)('refuses %s without a query', async (role) => {
    await expect(listDeliveriesForDev(ctx(role))).rejects.toThrow('not permitted');
    await expect(listEmailLogForDev(ctx(role))).rejects.toThrow('not permitted');
    await expect(messageCounts24h(ctx(role))).rejects.toThrow('not permitted');
    await expect(listMessagesForDev(ctx(role))).rejects.toThrow('not permitted');
    expect(devDb.calls).toHaveLength(0);
  });
});

describe('listDeliveriesForDev', () => {
  it.each(['developer', 'super_admin'] as const)('masks every address for %s', async (role) => {
    devDb.results.push([
      { id: 'd1', createdAt: when, eventType: 'step_waiting', channel: 'email', status: 'sent', skipReason: null, errorCode: null, toAddress: 'priya@northwind.in' },
      { id: 'd2', createdAt: when, eventType: 'step_waiting', channel: 'whatsapp', status: 'skipped', skipReason: 'no_consent', errorCode: null, toAddress: '+919876543210' },
      { id: 'd3', createdAt: when, eventType: 'step_waiting', channel: 'whatsapp', status: 'skipped', skipReason: 'no_phone', errorCode: null, toAddress: null },
    ]);
    const rows = await listDeliveriesForDev(ctx(role));
    expect(rows.map((r) => r.to)).toEqual(['p•••@northwind.in', '+91•••10', '']);
    const text = JSON.stringify(rows);
    expect(text).not.toContain('priya');
    expect(text).not.toContain('9876543210');
  });

  it('filters by channel and status in the query', async () => {
    devDb.results.push([]);
    await listDeliveriesForDev(ctx('developer'), { channel: 'whatsapp', status: 'failed' });
    const q = dialect.sqlToQuery(devDb.calls[0].where!);
    expect(q.params).toEqual(['whatsapp', 'failed']);
  });
});

describe('listMessagesForDev', () => {
  it('returns a cursor only when a list is full', async () => {
    devDb.results.push(
      [{ id: 'd1', createdAt: when, eventType: 'e', channel: 'email', status: 'sent', skipReason: null, errorCode: null, toAddress: 'a@b.co' }],
      [],
      [{ bucket: 'sent', n: 3 }],
      [{ bucket: 'failed', n: 1 }],
    );
    const out = await listMessagesForDev(ctx('developer'), { limit: 1 });
    expect(out.nextBefore).toEqual({ deliveries: when.toISOString(), emails: null });
    expect(out.counts24h).toEqual({ sent: 3, failed: 1, skipped: 0 });
  });
});
