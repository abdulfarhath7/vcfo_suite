import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import { devDb } from './dev-test-db';

/** Developer console: table sizes from the catalog. Developer and super admin only. */

vi.mock('@/db/client', async () => (await import('./dev-test-db')).mockDbModule);

const { getDatabaseStatsForDev } = await import('./dev-data');

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `u-${role}`, email: `${role}@vcfo.local`, name: role, role });

beforeEach(() => devDb.reset());

describe('getDatabaseStatsForDev', () => {
  it.each(['admin', 'manager', 'intern', 'client'] as const)('refuses %s without a query', async (role) => {
    await expect(getDatabaseStatsForDev(ctx(role))).rejects.toThrow('not permitted');
    expect(devDb.calls).toHaveLength(0);
  });

  it.each(['developer', 'super_admin'] as const)('reads catalog numbers for %s', async (role) => {
    devDb.results.push(
      { rows: [{ name: 'engagements', rows: '42', bytes: '81920' }] },
      { rows: [{ bytes: '9000000' }] },
    );
    const out = await getDatabaseStatsForDev(ctx(role));
    expect(out).toEqual({ bytes: 9000000, tables: [{ name: 'engagements', rows: 42, bytes: 81920 }] });
    expect(devDb.calls.map((c) => c.op)).toEqual(['execute', 'execute']);
  });
});
