import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * Only the super admin removes a super admin or a developer account. A firm admin is
 * refused before any write.
 */

let target: Record<string, unknown> | undefined;
const transaction = vi.fn();

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const chain: Record<string, unknown> = {};
      for (const k of ['from', 'where']) chain[k] = () => chain;
      chain.limit = async () => (target ? [target] : []);
      return chain;
    },
    transaction: (...a: unknown[]) => transaction(...a),
  },
}));

const { deleteProfileAccount } = await import('@/db/repositories/profiles');

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `u-${role}`, email: `${role}@x`, name: role, role });

beforeEach(() => {
  vi.clearAllMocks();
  target = undefined;
});

describe('deleteProfileAccount', () => {
  it.each(['developer', 'super_admin'])('refuses a firm admin deleting a %s account', async (role) => {
    target = { id: 'p1', email: 'p1@x', name: 'P', role, reportsToManagerId: null };
    await expect(deleteProfileAccount(ctx('admin'), 'p1')).rejects.toThrow('cannot_edit_super_admin');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lets the super admin reach the delete for a developer', async () => {
    target = { id: 'p1', email: 'p1@x', name: 'P', role: 'developer', reportsToManagerId: null };
    transaction.mockResolvedValue(undefined);
    await deleteProfileAccount(ctx('super_admin'), 'p1').catch(() => undefined);
    expect(transaction).toHaveBeenCalled();
  });
});
