import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * The staff timeline save (`engagement-timeline.ts`): only managers and admins reach the
 * schedule writes, and every window goes through `setEngagementWindow`, which checks the
 * engagement scope again (cross-tenant: a refused engagement stops the save).
 */

const setEngagementWindow = vi.fn();
vi.mock('@/db/repositories/schedule', () => ({ setEngagementWindow: (...a: unknown[]) => setEngagementWindow(...a) }));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn() }));

const { saveEngagementTimeline, TimelineSaveError } = await import('@/db/repositories/engagement-timeline');
const ctx = (role: AuthContext['role']): AuthContext => ({ userId: 'u1', email: 'u@x', name: 'U', role });
const parts = [
  { id: 'p1' as const, from: '2026-11-01', to: '2026-11-10' },
  { id: 'coi' as const, from: '2026-12-01', to: '2026-12-01' },
];

beforeEach(() => setEngagementWindow.mockReset());

describe('saveEngagementTimeline', () => {
  it('refuses leads, clients and developers before any write', async () => {
    for (const role of ['intern', 'client', 'developer'] as const) {
      await expect(saveEngagementTimeline(ctx(role), 'eng-1', parts)).rejects.toBeInstanceOf(TimelineSaveError);
    }
    expect(setEngagementWindow).not.toHaveBeenCalled();
  });

  it('refuses an end before a start', async () => {
    await expect(saveEngagementTimeline(ctx('manager'), 'eng-1', [{ id: 'p1', from: '2026-11-10', to: '2026-11-01' }])).rejects.toBeInstanceOf(TimelineSaveError);
  });

  it('writes the step windows and the incorporation window through the scoped writer', async () => {
    const n = await saveEngagementTimeline(ctx('manager'), 'eng-1', parts);
    expect(n).toBe(setEngagementWindow.mock.calls.length);
    expect(setEngagementWindow.mock.calls.every((c) => c[1] === 'eng-1')).toBe(true);
    expect(setEngagementWindow.mock.calls.at(-1)?.[2]).toEqual({ kind: 'incorporation' });
    expect(setEngagementWindow.mock.calls.at(-1)?.[3]).toEqual({ from: '2026-11-01', to: '2026-12-01' });
    expect(setEngagementWindow).toHaveBeenCalledWith(expect.anything(), 'eng-1', { kind: 'step', itemId: 'pre-12' }, { from: '2026-12-01', to: '2026-12-01' });
  });

  it('stops when the scoped writer refuses the engagement', async () => {
    setEngagementWindow.mockRejectedValueOnce(new Error('Engagement not found or not permitted'));
    await expect(saveEngagementTimeline(ctx('manager'), 'other-firm', parts)).rejects.toThrow('not permitted');
    expect(setEngagementWindow).toHaveBeenCalledTimes(1);
  });
});
