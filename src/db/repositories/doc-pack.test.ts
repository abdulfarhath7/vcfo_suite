import { describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * The document pack repository never lets a client through, and answers
 * "not found" / "forbidden" exactly as `assertEngagementAccess` does, so a
 * caller cannot learn whether an engagement exists from the pack.
 */

vi.mock('server-only', () => ({}));

const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...args: unknown[]) => assertEngagementAccess(...args),
  checklistStateFromRow: (row: { checklistState?: unknown }) => row.checklistState ?? {},
  toAppEngagement: (row: { id: string; companyName: string }) => ({ id: row.id, companyName: row.companyName }),
}));
vi.mock('@/db/repositories/board-resolution', () => ({
  getBoardResolutionByEngagementId: async () => ({ content: '', status: 'draft' }),
}));

const { getDocPackInputs } = await import('@/db/repositories/doc-pack');

const DB_ID = '11111111-1111-4111-8111-111111111111';
function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `u-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

describe('getDocPackInputs', () => {
  it('refuses a client before touching the engagement', async () => {
    const result = await getDocPackInputs(ctx('client'), DB_ID);
    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' });
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });

  it('passes forbidden and not-found through unchanged', async () => {
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: DB_ID, forbidden: true });
    expect(await getDocPackInputs(ctx('intern'), DB_ID)).toEqual({ ok: false, status: 403, error: 'forbidden' });
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: DB_ID, notFound: true });
    expect(await getDocPackInputs(ctx('manager'), DB_ID)).toEqual({ ok: false, status: 404, error: 'not_found' });
  });

  it('returns the engagement, its checklist state and the board resolution row', async () => {
    assertEngagementAccess.mockResolvedValueOnce({
      ok: true,
      dbId: DB_ID,
      row: { id: DB_ID, companyName: 'Demo Pvt Ltd', checklistState: { 'pre-1': { status: 'completed' } } },
    });
    const result = await getDocPackInputs(ctx('admin'), DB_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.inputs.engagement.companyName).toBe('Demo Pvt Ltd');
      expect(result.inputs.checklistState['pre-1']?.status).toBe('completed');
      expect(result.inputs.brRow?.status).toBe('draft');
    }
  });
});
