import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * "Mark filed" (filing-filed.ts): only manager / admin / super admin write,
 * only on an engagement the caller may read (cross-tenant reads as not found),
 * never a future date, and `status` follows `filed_on`.
 */

const assertEngagementAccess = vi.fn();
const recordAuditEvent = vi.fn();
let selectRows: unknown[] = [];
let updateSet: Record<string, unknown> | undefined;

vi.mock('server-only', () => ({}));
vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(selectRows),
      };
      return chain;
    },
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updateSet = v;
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: (selectRows[0] as { id: string }).id, filedOn: v.filedOn ?? null, status: v.status }]),
          }),
        };
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
vi.mock('@/lib/client-portal/compliances', () => ({ todayIso: () => '2026-10-29' }));

const { setComplianceInstanceFiled, FilingFiledError } = await import('@/db/repositories/filing-filed');

const ID = '33333333-3333-3333-3333-333333333303';
const ENG = '11111111-1111-1111-1111-111111111101';
const ctx = (role: AuthContext['role']): AuthContext => ({ userId: 'u1', email: 'pm@demo.vcfo.local', name: 'PM', role });

beforeEach(() => {
  vi.clearAllMocks();
  updateSet = undefined;
  selectRows = [{ id: ID, engagementId: ENG, dueDate: '2026-10-20', filedOn: null }];
  assertEngagementAccess.mockResolvedValue({ ok: true, dbId: ENG });
});

describe('setComplianceInstanceFiled', () => {
  it('marks filed and sets status filed', async () => {
    const r = await setComplianceInstanceFiled(ctx('manager'), ID, '2026-10-18');
    expect(updateSet).toEqual({ filedOn: '2026-10-18', status: 'filed' });
    expect(r.status).toBe('filed');
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'compliance.filed', engagementId: ENG }));
  });

  it('clearing restores the status from the due date', async () => {
    await setComplianceInstanceFiled(ctx('admin'), ID, null);
    expect(updateSet).toEqual({ filedOn: null, status: 'overdue' });
    selectRows = [{ id: ID, engagementId: ENG, dueDate: '2026-11-20', filedOn: '2026-10-01' }];
    await setComplianceInstanceFiled(ctx('super_admin'), ID, null);
    expect(updateSet).toEqual({ filedOn: null, status: 'upcoming' });
  });

  it('refuses leads and clients before touching the database', async () => {
    for (const role of ['intern', 'client'] as const) {
      await expect(setComplianceInstanceFiled(ctx(role), ID, '2026-10-18')).rejects.toMatchObject({ status: 403 });
    }
    expect(updateSet).toBeUndefined();
  });

  it('another manager’s filing reads as not found', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: ENG, forbidden: true });
    await expect(setComplianceInstanceFiled(ctx('manager'), ID, '2026-10-18')).rejects.toMatchObject({ status: 404 });
    expect(updateSet).toBeUndefined();
  });

  it('rejects a future date, a bad date and a bad id', async () => {
    await expect(setComplianceInstanceFiled(ctx('manager'), ID, '2026-10-30')).rejects.toBeInstanceOf(FilingFiledError);
    await expect(setComplianceInstanceFiled(ctx('manager'), ID, '18-10-2026')).rejects.toMatchObject({ status: 400 });
    await expect(setComplianceInstanceFiled(ctx('manager'), 'nope', '2026-10-18')).rejects.toMatchObject({ status: 404 });
    selectRows = [];
    await expect(setComplianceInstanceFiled(ctx('manager'), ID, '2026-10-18')).rejects.toMatchObject({ status: 404 });
  });
});
