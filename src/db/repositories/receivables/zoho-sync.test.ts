import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * Sync from Zoho on a receivable sheet: anyone who may edit the sheet (`scopedSheet`) reads its
 * source and presses Sync; only firm-wide admins choose Zoho and the organisation behind it.
 */
vi.mock('server-only', () => ({}));

type Call = { op: string; set?: unknown; values?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];
function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    leftJoin: () => c,
    orderBy: () => c,
    limit: () => c,
    where: () => c,
    returning: () => c,
    onConflictDoNothing: () => c,
    set: (s: unknown) => ((call.set = s), c),
    values: (v: unknown) => ((call.values = v), c),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}
const op = (name: string) => () => {
  const call: Call = { op: name };
  calls.push(call);
  return chain(call);
};
vi.mock('@/db/client', () => ({ db: { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') } }));

const scopedSheet = vi.fn();
vi.mock('./shared', async (orig) => ({ ...(await orig<typeof import('./shared')>()), scopedSheet: (...a: unknown[]) => scopedSheet(...a), logChange: vi.fn(async () => undefined) }));
vi.mock('./tally-sync', () => ({ jobActor: vi.fn(async () => null) }));

const repo = await import('./zoho-sync');
const SHEET = '11111111-1111-1111-1111-111111111111';
const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `u-${role}`, email: `${role}@x`, name: role, role });
const sheet = (p: Record<string, unknown> = {}) => ({ id: SHEET, source: 'excel', zohoApp: null, zohoOrgId: null, managerUserId: 'u-manager', ...p });

beforeEach(() => {
  calls.length = 0;
  results = [];
  scopedSheet.mockReset();
});

describe('sheet source', () => {
  it('a sheet the caller may not edit reads as not found before any query', async () => {
    scopedSheet.mockRejectedValue(Object.assign(new Error('not_found'), { status: 404 }));
    await expect(repo.getZohoSheetStatus(ctx('manager'), SHEET)).rejects.toThrow('not_found');
    await expect(repo.queueZohoSheetSync(ctx('manager'), SHEET, { type: 'sales', from: '2026-04-01', to: '2026-11-25' })).rejects.toThrow('not_found');
    expect(calls).toHaveLength(0);
  });

  it('a manager may not choose Zoho', async () => {
    scopedSheet.mockResolvedValue(sheet());
    await expect(repo.setSheetSource(ctx('manager'), SHEET, { source: 'zoho', zohoApp: 'books', zohoOrgId: '1' })).rejects.toThrow('not_found');
    expect(calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('an admin may choose a Books organisation found on the firm connection', async () => {
    scopedSheet.mockResolvedValue(sheet());
    results = [[{ id: 'conn' }], [{ id: 'org', name: 'SBC Consulting LLP' }]];
    await repo.setSheetSource(ctx('admin'), SHEET, { source: 'zoho', zohoApp: 'books', zohoOrgId: '6001' }).catch(() => undefined);
    expect(calls.find((c) => c.op === 'update')?.set).toMatchObject({ source: 'zoho', zohoApp: 'books', zohoOrgId: '6001' });
  });

  it('refuses an organisation that discovery did not find', async () => {
    scopedSheet.mockResolvedValue(sheet());
    results = [[{ id: 'conn' }], []];
    await expect(repo.setSheetSource(ctx('super_admin'), SHEET, { source: 'zoho', zohoApp: 'books', zohoOrgId: 'nope' })).rejects.toThrow('zoho_org');
  });
});

describe('queue a Zoho sync', () => {
  it('needs the sheet to be a Zoho sheet', async () => {
    scopedSheet.mockResolvedValue(sheet());
    await expect(repo.queueZohoSheetSync(ctx('manager'), SHEET, { type: 'sales', from: '2026-04-01', to: '2026-11-25' })).rejects.toThrow('zoho_not_set_up');
  });

  it('checks the type and the period', async () => {
    scopedSheet.mockResolvedValue(sheet({ source: 'zoho', zohoApp: 'books', zohoOrgId: '6001' }));
    await expect(repo.queueZohoSheetSync(ctx('manager'), SHEET, { type: 'x', from: '2026-04-01', to: '2026-11-25' })).rejects.toThrow('sync_type');
    await expect(repo.queueZohoSheetSync(ctx('manager'), SHEET, { type: 'sales', from: '2026-11-25', to: '2026-04-01' })).rejects.toThrow('sync_period');
  });

  it('queues one job per sheet with the sheet as its key', async () => {
    scopedSheet.mockResolvedValue(sheet({ source: 'zoho', zohoApp: 'books', zohoOrgId: '6001' }));
    const now = new Date();
    results = [[{ id: 'conn' }], [], [{ id: 'job1', status: 'queued', params: { type: 'receipts', from: '2026-04-01', to: '2026-11-25' }, stats: {}, error: null, createdAt: now, finishedAt: null }]];
    const job = await repo.queueZohoSheetSync(ctx('manager'), SHEET, { type: 'receipts', from: '2026-04-01', to: '2026-11-25' });
    expect(job).toMatchObject({ id: 'job1', type: 'receipts', status: 'queued' });
    expect(calls.find((c) => c.op === 'insert')?.values).toMatchObject({ module: 'receivables', targetKey: SHEET, params: { orgId: '6001', app: 'books' } });
  });

  it('answers sync_running when a job of the sheet is active', async () => {
    scopedSheet.mockResolvedValue(sheet({ source: 'zoho', zohoApp: 'books', zohoOrgId: '6001' }));
    results = [[{ id: 'conn' }], [], []];
    await expect(repo.queueZohoSheetSync(ctx('manager'), SHEET, { type: 'sales', from: '2026-04-01', to: '2026-11-25' })).rejects.toThrow('sync_running');
  });
});
