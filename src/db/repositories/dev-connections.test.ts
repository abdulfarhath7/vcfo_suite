import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { devDb } from './dev-test-db';

/**
 * Developer console: Outlook connections. Developer and super admin read every row; every
 * other role is refused before a query runs. Tokens are never selected, and a client owner
 * is shown as "Client" with the mailbox masked.
 */

vi.mock('@/db/client', async () => (await import('./dev-test-db')).mockDbModule);

const { listOutlookConnectionsForDev } = await import('./dev-connections');

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `u-${role}`, email: `${role}@vcfo.local`, name: role, role });
const when = new Date('2026-10-20T10:00:00Z');

beforeEach(() => devDb.reset());

describe('listOutlookConnectionsForDev', () => {
  it.each(['admin', 'manager', 'intern', 'client'] as const)('refuses %s without a query', async (role) => {
    await expect(listOutlookConnectionsForDev(ctx(role))).rejects.toThrow('not permitted');
    expect(devDb.calls).toHaveLength(0);
  });

  it.each(['developer', 'super_admin'] as const)('lets %s read, with no token in the result', async (role) => {
    devDb.results.push([
      { id: 'c1', msEmail: 'lead@sbcllp.in', expiresAt: when, signatureEnabled: true, createdAt: when, updatedAt: when, name: 'Asha Lead', email: 'lead@sbcllp.in', role: 'intern' },
      { id: 'c2', msEmail: 'owner@client.co', expiresAt: when, signatureEnabled: false, createdAt: when, updatedAt: when, name: 'Ravi Client', email: 'owner@client.co', role: 'client' },
    ]);
    const rows = await listOutlookConnectionsForDev(ctx(role));
    expect(rows[0]).toMatchObject({ person: 'Asha Lead', mailbox: 'lead@sbcllp.in' });
    expect(rows[1]).toMatchObject({ person: 'Client', mailbox: 'o•••@client.co' });
    const text = JSON.stringify(rows);
    expect(text).not.toContain('Ravi');
    expect(text).not.toContain('owner@client.co');
    expect(text).not.toMatch(/token/i);
  });
});
