// @vitest-environment node
import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Tally connector routes (docs/specs/receivables/TALLY-LIVE.md): a missing, unknown or revoked
 * token gets 401 `revoked`; the long-poll answers a job as soon as one is claimed; a result is read
 * plain or gzipped. The repository is mocked.
 */

const connectorByToken = vi.fn();
const claimNextJob = vi.fn();
const touchConnector = vi.fn();
const saveJobResult = vi.fn();
vi.mock('@/db/repositories/receivables', () => ({
  connectorByToken: (...a: unknown[]) => connectorByToken(...a),
  claimNextJob: (...a: unknown[]) => claimNextJob(...a),
  touchConnector: (...a: unknown[]) => touchConnector(...a),
  saveJobResult: (...a: unknown[]) => saveJobResult(...a),
  TallyJobError: class TallyJobError extends Error {},
}));

const jobs = await import('../../../../app/api/tally/connector/jobs/route');
const result = await import('../../../../app/api/tally/connector/jobs/[id]/result/route');

const CONNECTOR = { id: 'c1', sheetId: 's1' };
const authed = (init: RequestInit = {}) => ({ ...init, headers: { authorization: 'Bearer tc_good', ...(init.headers as Record<string, string>) } });

beforeEach(() => {
  vi.clearAllMocks();
  connectorByToken.mockImplementation(async (t: string) => (t === 'tc_good' ? CONNECTOR : null));
});

describe('connector auth', () => {
  it('refuses a revoked or missing token with 401 revoked', async () => {
    const res = await jobs.GET(new Request('http://x/api/tally/connector/jobs', { headers: { authorization: 'Bearer tc_old' } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'revoked' });
    const none = await jobs.GET(new Request('http://x/api/tally/connector/jobs'));
    expect(none.status).toBe(401);
    expect(claimNextJob).not.toHaveBeenCalled();
  });
});

describe('GET jobs', () => {
  it('answers the claimed job at once and marks the connector seen', async () => {
    claimNextJob.mockResolvedValue({ id: 'j1', type: 'sales', from: '2026-04-01', to: '2026-11-25' });
    const res = await jobs.GET(new Request('http://x/api/tally/connector/jobs', authed()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ job: { id: 'j1', type: 'sales', from: '2026-04-01', to: '2026-11-25' } });
    expect(touchConnector).toHaveBeenCalledWith(CONNECTOR);
  });

  it('answers 204 when the poll is cut short with no job', async () => {
    claimNextJob.mockResolvedValue(null);
    const ac = new AbortController();
    ac.abort();
    const res = await jobs.GET(new Request('http://x/api/tally/connector/jobs', { ...authed(), signal: ac.signal }));
    expect(res.status).toBe(204);
  });
});

describe('POST result', () => {
  const body = { ok: true, company: 'Summit', vouchers: [{ guid: 'g', voucherType: 'Sales', voucherNo: 'A/1', date: '2026-11-03', partyName: 'Duravant', amount: 100 }] };
  const params = { params: Promise.resolve({ id: 'j1' }) };

  it('reads a gzipped body and answers the staged count', async () => {
    saveJobResult.mockResolvedValue({ staged: 1 });
    const res = await result.POST(new Request('http://x', authed({ method: 'POST', body: gzipSync(JSON.stringify(body)), headers: { 'content-encoding': 'gzip' } })), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ staged: 1 });
    expect(saveJobResult).toHaveBeenCalledWith(CONNECTOR, 'j1', body);
  });

  it('fails the job when the body cannot be read', async () => {
    saveJobResult.mockResolvedValue({ staged: 0 });
    const res = await result.POST(new Request('http://x', authed({ method: 'POST', body: JSON.stringify({ ok: true, vouchers: 'x' }) })), params);
    expect(res.status).toBe(400);
    expect(saveJobResult.mock.calls[0]![2]).toMatchObject({ ok: false });
  });
});
