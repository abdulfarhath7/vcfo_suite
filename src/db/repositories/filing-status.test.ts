import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * Staff mark a filing filed or reopen it. A client or developer is refused, an
 * instance outside the caller's scope reads as not found, a future date is refused,
 * and only a manager or admin may reopen.
 */

const assertEngagementAccess = vi.fn();
const recordAuditEvent = vi.fn();
let selected: unknown[] = [];
let updatedSet: Record<string, unknown> | null = null;

// Filing events are written fire-and-forget after the action; they are tested in filing-events.test.ts.
vi.mock('@/db/repositories/filing-events', () => ({ recordFilingEvent: async () => undefined, windowEventLabel: () => '' }));
vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const chain: Record<string, unknown> = {};
      for (const k of ['from', 'where']) chain[k] = () => chain;
      chain.limit = async () => selected;
      return chain;
    },
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updatedSet = v;
        return { where: () => ({ returning: async () => [{ id: 'f1', status: v.status, filedOn: v.filedOn }] }) };
      },
    }),
  },
}));
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
}));
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));

const { markFilingFiled, reopenFiling } = await import('@/db/repositories/filing-status');

const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `u-${role}`, email: `${role}@x`, name: role, role });
const OPEN = { id: 'f1', engagementId: 'e1', status: 'in-progress', filedOn: null, filedNote: null, dueDate: '2026-10-20' };

beforeEach(() => {
  vi.clearAllMocks();
  selected = [OPEN];
  updatedSet = null;
  assertEngagementAccess.mockResolvedValue({ ok: true, dbId: 'e1' });
});

describe('markFilingFiled', () => {
  it('lets a lead in scope mark a filing filed and audits it', async () => {
    const row = await markFilingFiled(ctx('intern'), 'f1', { filedOn: '2026-10-18' });
    expect(row.status).toBe('filed');
    expect(updatedSet).toMatchObject({ status: 'filed', filedOn: '2026-10-18' });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'compliance.filed', metadata: expect.objectContaining({ onTime: true }) }),
    );
  });

  it('refuses a client and a developer before any read', async () => {
    await expect(markFilingFiled(ctx('client'), 'f1')).rejects.toMatchObject({ status: 403 });
    await expect(markFilingFiled(ctx('developer'), 'f1')).rejects.toMatchObject({ status: 403 });
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });

  it('reads another firm’s filing as not found', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: 'e1', forbidden: true });
    await expect(markFilingFiled(ctx('manager'), 'f1')).rejects.toMatchObject({ status: 404 });
    expect(updatedSet).toBeNull();
  });

  it('refuses a future date and a filing already filed', async () => {
    await expect(markFilingFiled(ctx('admin'), 'f1', { filedOn: '2999-01-01' })).rejects.toMatchObject({ status: 400 });
    selected = [{ ...OPEN, status: 'filed', filedOn: '2026-10-01' }];
    await expect(markFilingFiled(ctx('admin'), 'f1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('reopenFiling', () => {
  it('lets a manager reopen a filed filing', async () => {
    selected = [{ ...OPEN, status: 'filed', filedOn: '2026-10-01' }];
    const row = await reopenFiling(ctx('manager'), 'f1');
    expect(row.filedOn).toBeNull();
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'compliance.reopened' }));
  });

  it('refuses a lead', async () => {
    selected = [{ ...OPEN, status: 'filed', filedOn: '2026-10-01' }];
    await expect(reopenFiling(ctx('intern'), 'f1')).rejects.toMatchObject({ status: 403 });
  });
});
