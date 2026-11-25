import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * Tally live sync repository (docs/specs/receivables/TALLY-LIVE.md): token auth, pairing, claiming
 * a job, staging a result as the person who pressed Sync, and one sync at a time. The database is a
 * queue of results, one per awaited query, in order.
 */

type Call = { op: string; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];
function chain(call: Call): unknown {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit', 'returning']) c[m] = () => c;
  c.values = (v: unknown) => ((call.values = v), c);
  c.set = (v: unknown) => ((call.set = v), c);
  c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej);
  return c;
}
const op = (name: string) => () => {
  const call: Call = { op: name };
  calls.push(call);
  return chain(call);
};
const db: Record<string, unknown> = { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') };
db.transaction = async (fn: (tx: unknown) => unknown) => fn(db);
vi.mock('@/db/client', () => ({ db }));
vi.mock('server-only', () => ({}));
const stageTallyImport = vi.fn();
const stageTallyReceipts = vi.fn();
vi.mock('@/db/repositories/receivables/imports', () => ({
  stageTallyImport: (...a: unknown[]) => stageTallyImport(...a),
  stageTallyReceipts: (...a: unknown[]) => stageTallyReceipts(...a),
}));

const repo = await import('@/db/repositories/receivables/tally-sync');

const SHEET = '11111111-1111-1111-1111-111111111101';
const MANAGER = '33333333-3333-3333-3333-333333333303';
const JOB = '77777777-7777-7777-7777-777777777707';
const NOW = new Date('2026-11-25T06:00:00Z');
const manager: AuthContext = { userId: MANAGER, email: 'm@vcfo.local', name: 'Krishna', role: 'manager' };
const sheetRow = { id: SHEET, name: 'Summit Consulting', managerUserId: MANAGER };
const connector = { id: 'c1', sheetId: SHEET, tokenHash: 'h', revokedAt: null, name: 'TALLY-PC', version: '1.0.0', tallyCompany: 'Summit', tallyReachable: true } as never;
const jobRow = (over: Record<string, unknown> = {}) => ({
  id: JOB,
  sheetId: SHEET,
  connectorId: 'c1',
  type: 'sales',
  fromDate: '2026-11-01',
  toDate: '2026-11-25',
  status: 'running',
  requestedBy: MANAGER,
  createdAt: NOW,
  startedAt: NOW,
  finishedAt: null,
  error: null,
  stats: null,
  ...over,
});
const updates = () => calls.filter((c) => c.op === 'update');

beforeEach(() => {
  calls.length = 0;
  results = [];
  vi.clearAllMocks();
});

describe('connectorByToken', () => {
  it('refuses a revoked or unknown token, and a malformed one without a query', async () => {
    results = [[]];
    expect(await repo.connectorByToken('tc_revoked')).toBeNull();
    expect(await repo.connectorByToken('not-a-token')).toBeNull();
    expect(await repo.connectorByToken(null)).toBeNull();
    expect(calls).toHaveLength(1);
  });
});

describe('pairConnector', () => {
  it('pairs once with a fresh code: keeps only the token hash and revokes the older connector', async () => {
    results = [[{ connector: { id: 'c2', sheetId: SHEET, createdBy: MANAGER, pairingExpiresAt: new Date(NOW.getTime() + 60_000) }, sheetName: 'Summit Consulting' }], [{ id: 'c2' }], [], []];
    const out = await repo.pairConnector({ code: 'abcd-efgh', name: 'TALLY-PC', version: '1.0.0', tallyCompany: 'Summit' }, NOW);
    expect(out?.sheetName).toBe('Summit Consulting');
    expect(out?.token).toMatch(/^tc_[A-Za-z0-9_-]{43}$/);
    const [pair, revoke] = updates();
    expect((pair!.set as { tokenHash: string }).tokenHash).toBe(repo.sha256(out!.token));
    expect(pair!.set).toMatchObject({ pairingCodeHash: null, name: 'TALLY-PC' });
    expect(revoke!.set).toMatchObject({ revokedAt: NOW });
  });

  it('refuses an expired code', async () => {
    results = [[{ connector: { id: 'c2', sheetId: SHEET, pairingExpiresAt: new Date(NOW.getTime() - 1) }, sheetName: 'x' }]];
    expect(await repo.pairConnector({ code: 'ABCDEFGH' }, NOW)).toBeNull();
    expect(updates()).toHaveLength(0);
  });
});

describe('claimNextJob', () => {
  it('gives the oldest queued job to the connector and marks it running', async () => {
    results = [[], [], [jobRow({ status: 'queued', startedAt: null })], [jobRow()]];
    const job = await repo.claimNextJob(connector, NOW);
    expect(job).toEqual({ id: JOB, type: 'sales', from: '2026-11-01', to: '2026-11-25' });
    const claim = updates()[2]!;
    expect(claim.set).toMatchObject({ status: 'running', startedAt: NOW, connectorId: 'c1' });
  });

  it('answers null when nothing waits', async () => {
    results = [[], [], []];
    expect(await repo.claimNextJob(connector, NOW)).toBeNull();
  });
});

describe('saveJobResult', () => {
  const profile = { id: MANAGER, email: 'm@vcfo.local', name: 'Krishna', role: 'manager', internId: null, clientId: null, status: 'active' };

  it('stages sales vouchers as the person who pressed Sync and finishes the job', async () => {
    results = [[jobRow()], [], [profile], []];
    stageTallyImport.mockResolvedValue({ batchId: 'b1', rows: [{ batchId: 'b1', kind: 'new' }, { batchId: 'b1', kind: 'same' }] });
    const out = await repo.saveJobResult(
      connector,
      JOB,
      {
        ok: true,
        company: 'Summit',
        vouchers: [
          { guid: 'g1', voucherType: 'Sales', voucherNo: 'A/1', date: '2026-11-03', partyName: 'Duravant', amount: 100 },
          { guid: 'g2', voucherType: 'Sales', voucherNo: 'A/2', date: '2026-11-04', partyName: 'Duravant', amount: 200 },
        ],
      },
      NOW,
    );
    expect(out).toEqual({ staged: 1 });
    const [ctx, sheetId, fileName, mapped, opts] = stageTallyImport.mock.calls[0]!;
    expect(ctx).toMatchObject({ userId: MANAGER, role: 'manager' });
    expect(sheetId).toBe(SHEET);
    expect(fileName).toBe('Tally sync 1 Nov–25 Nov 2026');
    expect((mapped as { rows: unknown[] }).rows).toHaveLength(2);
    expect(opts).toEqual({ source: 'tally_live' });
    expect(updates().at(-1)!.set).toMatchObject({ status: 'done', batchId: 'b1', stats: { vouchers: 2, staged: 1, skipped: 0, receipts: 0 } });
  });

  it('fails the job with the connector error', async () => {
    results = [[jobRow()], [], []];
    expect(await repo.saveJobResult(connector, JOB, { ok: false, error: 'Tally is not running' }, NOW)).toEqual({ staged: 0 });
    expect(updates().at(-1)!.set).toMatchObject({ status: 'failed', error: 'Tally is not running' });
  });

  it('refuses a job that is not running', async () => {
    results = [[jobRow({ status: 'expired' })]];
    await expect(repo.saveJobResult(connector, JOB, { ok: true, company: '', vouchers: [] }, NOW)).rejects.toMatchObject({ status: 409 });
  });
});

describe('queueSyncJob', () => {
  it('refuses a second sync while one is queued or running', async () => {
    results = [[sheetRow], [connector], [], [], [{ id: 'j0' }]];
    await expect(repo.queueSyncJob(manager, SHEET, { type: 'sales', from: '2026-04-01', to: '2026-11-25' }, NOW)).rejects.toMatchObject({ code: 'sync_running' });
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('refuses when Tally is not connected', async () => {
    results = [[sheetRow], []];
    await expect(repo.queueSyncJob(manager, SHEET, { type: 'receipts', from: '2026-04-01', to: '2026-11-25' }, NOW)).rejects.toMatchObject({ code: 'tally_not_connected' });
  });

  it('refuses a period that ends before it starts', async () => {
    results = [[sheetRow]];
    await expect(repo.queueSyncJob(manager, SHEET, { type: 'sales', from: '2026-11-25', to: '2026-04-01' }, NOW)).rejects.toMatchObject({ code: 'sync_period' });
  });
});
