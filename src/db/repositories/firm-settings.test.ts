import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * firm_settings (G-02):
 *   read    — super admin, admin, manager, project lead; client and developer refused before a query
 *   write   — super admin and admin only; one audit event per changed field, with old and new
 *   history — super admin and admin; everyone else gets [] without a query
 */

type Call = { op: string; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];

function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    where: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
    onConflictDoUpdate: (cfg: { set: unknown }) => {
      call.set = cfg.set;
      return c;
    },
    values: (v: unknown) => {
      call.values = v;
      return c;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}
function op(name: string) {
  return () => {
    const call: Call = { op: name };
    calls.push(call);
    return chain(call);
  };
}

vi.mock('@/db/client', () => ({
  db: { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') },
}));

const recordAuditEvent = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a),
}));

const repo = await import('@/db/repositories/firm-settings');

function ctx(role: AuthContext['role']): AuthContext {
  return { userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role };
}

function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    row: {
      id: 'firm',
      firmName: 'SBC',
      logoObjectKey: null,
      workingDays: [1, 2, 3, 4, 5, 6],
      holidays: [],
      reminderDays: [7, 3, 1],
      timezone: 'Asia/Kolkata',
      supportEmail: null,
      supportPhone: null,
      address: null,
      updatedBy: null,
      updatedAt: new Date('2026-10-01T00:00:00Z'),
      ...overrides,
    },
    updatedByName: null,
    updatedByEmail: null,
  };
}

const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
});

describe('getFirmSettings', () => {
  it.each(['super_admin', 'admin', 'manager', 'intern'] as const)('%s reads the settings', async (role) => {
    results = [[storedRow()]];
    const settings = await repo.getFirmSettings(ctx(role));
    expect(settings.firmName).toBe('SBC');
    expect(settings.hasLogo).toBe(false);
  });

  it('returns the defaults before anyone saves', async () => {
    results = [[]];
    const settings = await repo.getFirmSettings(ctx('manager'));
    expect(settings.workingDays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(settings.reminderDays).toEqual([7, 3, 1]);
    expect(settings.timezone).toBe('Asia/Kolkata');
  });

  it.each(['client', 'developer'] as const)('%s is refused before any query', async (role) => {
    await expect(repo.getFirmSettings(ctx(role))).rejects.toBeInstanceOf(repo.FirmSettingsForbiddenError);
    await expect(repo.getFirmLogoKey(ctx(role))).rejects.toBeInstanceOf(repo.FirmSettingsForbiddenError);
    expect(calls).toHaveLength(0);
  });
});

describe('updateFirmSettings', () => {
  it.each(['manager', 'intern', 'client', 'developer'] as const)(
    '%s may not change settings and writes nothing',
    async (role) => {
      await expect(repo.updateFirmSettings(ctx(role), { firmName: 'X' })).rejects.toBeInstanceOf(
        repo.FirmSettingsForbiddenError,
      );
      await expect(repo.setFirmLogoKey(ctx(role), 'k')).rejects.toBeInstanceOf(repo.FirmSettingsForbiddenError);
      expect(calls).toHaveLength(0);
      expect(recordAuditEvent).not.toHaveBeenCalled();
    },
  );

  it.each(['super_admin', 'admin'] as const)('%s writes only changed fields and audits each', async (role) => {
    results = [[storedRow()], []];
    const { changes, settings } = await repo.updateFirmSettings(ctx(role), {
      firmName: 'SBC',
      supportEmail: 'help@sbcllp.in',
      reminderDays: [1, 5],
    });
    expect(changes.map((c) => c.field)).toEqual(['supportEmail', 'reminderDays']);
    expect(writes()).toHaveLength(1);
    expect(writes()[0]!.set).toMatchObject({
      supportEmail: 'help@sbcllp.in',
      reminderDays: [5, 1],
      updatedBy: `user-${role}`,
    });
    expect(writes()[0]!.set).not.toHaveProperty('firmName');
    expect(recordAuditEvent).toHaveBeenCalledTimes(2);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      ctx(role),
      expect.objectContaining({
        action: 'firm_settings.reminderDays',
        metadata: { field: 'reminderDays', old: [7, 3, 1], new: [5, 1] },
      }),
    );
    expect(settings.reminderDays).toEqual([5, 1]);
  });

  it('writes nothing when nothing changes', async () => {
    results = [[storedRow()]];
    const { changes } = await repo.updateFirmSettings(ctx('admin'), { firmName: 'SBC' });
    expect(changes).toEqual([]);
    expect(writes()).toHaveLength(0);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe('setFirmLogoKey', () => {
  it('returns the replaced key and audits the change', async () => {
    results = [[{ key: 'firm/logo-old' }], []];
    const out = await repo.setFirmLogoKey(ctx('super_admin'), 'firm/logo-new');
    expect(out.previousKey).toBe('firm/logo-old');
    expect(recordAuditEvent).toHaveBeenCalledWith(
      ctx('super_admin'),
      expect.objectContaining({ action: 'firm_settings.logo', metadata: { field: 'logo', old: 'firm/logo-old', new: 'firm/logo-new' } }),
    );
  });
});

describe('listFirmSettingsHistory', () => {
  it.each(['manager', 'intern', 'client', 'developer'] as const)('%s gets [] without a query', async (role) => {
    expect(await repo.listFirmSettingsHistory(ctx(role))).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('admins read the settings changes', async () => {
    results = [[{ id: 'a1', createdAt: new Date('2026-10-02T00:00:00Z'), actorName: 'Mithilesh', actorEmail: null, summary: 'Firm name: SBC' }]];
    const rows = await repo.listFirmSettingsHistory(ctx('admin'));
    expect(rows).toEqual([{ id: 'a1', at: '2026-10-02T00:00:00.000Z', who: 'Mithilesh', summary: 'Firm name: SBC' }]);
  });
});
