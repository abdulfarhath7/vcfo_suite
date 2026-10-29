import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { devDb } from './dev-test-db';

/**
 * Developer console: access. Developer and super admin only. Staff are listed; clients come
 * back as counts and never by name or email.
 */

vi.mock('@/db/client', async () => (await import('./dev-test-db')).mockDbModule);

const { getAccessForDev, countSignedInStaffForDev } = await import('./dev-access');

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `u-${role}`, email: `${role}@vcfo.local`, name: role, role });
const seen = new Date('2026-10-28T09:00:00Z');

beforeEach(() => devDb.reset());

describe('dev access', () => {
  it.each(['admin', 'manager', 'intern', 'client'] as const)('refuses %s without a query', async (role) => {
    await expect(getAccessForDev(ctx(role))).rejects.toThrow('not permitted');
    await expect(countSignedInStaffForDev(ctx(role))).rejects.toThrow('not permitted');
    expect(devDb.calls).toHaveLength(0);
  });

  it.each(['developer', 'super_admin'] as const)('lists staff and counts clients for %s', async (role) => {
    devDb.results.push(
      [
        { id: 'p1', name: 'Meera Admin', email: 'meera@sbcllp.in', role: 'admin', status: 'active', lastSeenAt: seen, totpEnabledAt: seen, sessions: 2 },
        { id: 'p2', name: null, email: 'dev@sbcllp.in', role: 'developer', status: 'active', lastSeenAt: null, totpEnabledAt: null, sessions: null },
      ],
      [
        { role: 'admin', n: 1 },
        { role: 'client', n: 14 },
      ],
      [{ active: 14, inactive: 2, twoStep: 3, sessions: 5 }],
    );
    const out = await getAccessForDev(ctx(role));
    expect(out.staff).toEqual([
      { id: 'p1', name: 'Meera Admin', email: 'meera@sbcllp.in', role: 'admin', status: 'active', lastSeenAt: seen.toISOString(), twoStep: true, activeSessions: 2 },
      { id: 'p2', name: 'dev', email: 'dev@sbcllp.in', role: 'developer', status: 'active', lastSeenAt: null, twoStep: false, activeSessions: 0 },
    ]);
    expect(out.clients).toEqual({ active: 14, inactive: 2, twoStep: 3, activeSessions: 5 });
    expect(out.roles).toContainEqual({ role: 'client', people: 14 });
  });
});
