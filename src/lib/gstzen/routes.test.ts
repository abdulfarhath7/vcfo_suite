// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * The GSTZen routes' guards with the guards, the engagement scope, the database and the GSTZen
 * client replaced: a client is refused on every staff route and a staff member on the client route;
 * a lead is refused on another lead's engagement; every route that would call GSTZen answers 503
 * while GSTZen is not configured; and a client's OTP goes to GSTZen and nowhere else.
 */

const OWN = '11111111-1111-4111-8111-111111111101';
const OTHER = '22222222-2222-4222-8222-222222222202';
const REQ = '33333333-3333-4333-8333-333333333303';
const RUN = '44444444-4444-4444-8444-444444444404';
const lead: AuthContext = { userId: 'lead-1', email: 'l@x.test', name: 'Lead', role: 'intern', internId: 'i-1' };
const client: AuthContext = { userId: 'client-1', email: 'c@x.test', name: 'Client', role: 'client', clientId: 'cl-1' };
let caller: AuthContext = lead;

vi.mock('@/auth/guards', () => ({
  requireAnyRole: async (...roles: string[]) => (roles.includes(caller.role) ? { ok: true, ctx: caller } : { ok: false, status: 403, error: 'forbidden' }),
  requireRole: async (role: string) => (caller.role === role ? { ok: true, ctx: caller } : { ok: false, status: 403, error: 'forbidden' }),
}));

// The lead is on OWN only; the client owns OWN.
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: async (_c: AuthContext, id: string) => (id === OWN ? { ok: true, dbId: OWN, row: { id: OWN, companyName: 'Kestrel Robotics', checklistState: {} } } : { ok: false, dbId: id, forbidden: true }),
  listScopedEngagementIds: async () => [OWN],
  checklistStateFromRow: () => ({}),
}));

type Call = { op: string; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];
function chain(call: Call): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    innerJoin: () => c,
    orderBy: () => c,
    limit: () => c,
    returning: () => c,
    onConflictDoUpdate: () => c,
    where: () => c,
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

vi.mock('@/db/repositories/agent-settings', () => ({
  systemAgentSettings: async () => ({ killSwitch: false, gstzen: { live: true, pilotUserIds: [] }, browser: { live: false, pilotUserIds: [] }, browserHoursCap: 100, idleMinutes: 15, maxMinutes: 90, onePerLogin: true }),
}));
const audit = vi.fn(async () => undefined);
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: (...a: unknown[]) => audit(...(a as [])) }));
vi.mock('@/lib/gstzen/work', () => ({ queueReturnWork: vi.fn(async () => 'queued') }));
const api = {
  establishSession: vi.fn(async () => ({ status_cd: '1', expiry: 43200, expiry_time: 1_800_000_000 })),
  generateOtp: vi.fn(async () => 'OTP sent successfully.'),
  validateGstin: vi.fn(async () => ({ status: 1, valid: true })),
};
vi.mock('@/lib/gstzen/client', async (orig) => ({ ...(await orig<typeof import('./client')>()), gstzen: () => api }));

const status = await import('../../../app/api/gstzen/status/route');
const consent = await import('../../../app/api/gstzen/consent/route');
const otp = await import('../../../app/api/gstzen/otp/[id]/route');
const returns = await import('../../../app/api/gstzen/returns/route');
const run = await import('../../../app/api/gstzen/returns/[id]/route');
const notices = await import('../../../app/api/gstzen/notices/route');
const gstinCheck = await import('../../../app/api/gstzen/gstin-check/route');
const clientList = await import('../../../app/api/client/agent-otp/route');
const clientAnswer = await import('../../../app/api/client/agent-otp/[id]/route');

const get = (url: string) => new Request(`http://x${url}`);
const post = (url: string, body: unknown) => new Request(`http://x${url}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const otpRow = (over: Record<string, unknown> = {}) => ({
  id: REQ,
  engagementId: OWN,
  purpose: 'gstn_consent',
  subjectType: 'gstn_session',
  subjectId: '29AAFCC9980M1ZR',
  gstin: '29AAFCC9980M1ZR',
  sentTo: null,
  audience: 'client',
  status: 'pending',
  requestedBy: 'lead-1',
  requestedAt: new Date(),
  answeredBy: null,
  answeredAt: null,
  expiresAt: new Date(Date.now() + 5 * 60_000),
  ...over,
});

const ENV_KEYS = ['GSTZEN_USERNAME', 'GSTZEN_PASSWORD'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  caller = lead;
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.GSTZEN_USERNAME = 'firm@sbc.test';
  process.env.GSTZEN_PASSWORD = 'pw';
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('a client on the staff routes', () => {
  it('is refused with 403 before anything is read', async () => {
    caller = client;
    const answers = await Promise.all([
      status.GET(get(`/api/gstzen/status?engagementId=${OWN}`)),
      consent.POST(post('/api/gstzen/consent', { engagementId: OWN, audience: 'client' })),
      otp.POST(post(`/api/gstzen/otp/${REQ}`, { otp: '123456' }), params(REQ)),
      returns.GET(get(`/api/gstzen/returns?engagementId=${OWN}`)),
      returns.POST(post('/api/gstzen/returns', { engagementId: OWN, form: 'gstr3b', period: '102026' })),
      run.GET(get(`/api/gstzen/returns/${RUN}`), params(RUN)),
      run.POST(post(`/api/gstzen/returns/${RUN}`, { action: 'save' }), params(RUN)),
      notices.GET(get(`/api/gstzen/notices?engagementId=${OWN}`)),
      gstinCheck.POST(post('/api/gstzen/gstin-check', { engagementId: OWN })),
    ]);
    expect(answers.map((r) => r.status)).toEqual(Array(answers.length).fill(403));
    expect(calls).toHaveLength(0);
    expect(api.establishSession).not.toHaveBeenCalled();
  });
});

describe('staff on the client route', () => {
  it('is refused with 403', async () => {
    expect((await clientList.GET()).status).toBe(403);
    expect((await clientAnswer.POST(post(`/api/client/agent-otp/${REQ}`, { otp: '123456' }), params(REQ))).status).toBe(403);
  });
});

describe('a lead on another lead’s engagement', () => {
  it('is refused with 403', async () => {
    expect((await status.GET(get(`/api/gstzen/status?engagementId=${OTHER}`))).status).toBe(403);
    expect((await returns.GET(get(`/api/gstzen/returns?engagementId=${OTHER}`))).status).toBe(403);
    expect((await notices.GET(get(`/api/gstzen/notices?engagementId=${OTHER}`))).status).toBe(403);
    expect((await returns.POST(post('/api/gstzen/returns', { engagementId: OTHER, form: 'gstr3b', period: '102026' }))).status).toBe(403);
  });

  it('reads another lead’s run as not found', async () => {
    results = [[{ id: RUN, engagementId: OTHER, status: 'saved', summary: {}, checks: {} }]];
    expect((await run.GET(get(`/api/gstzen/returns/${RUN}`), params(RUN))).status).toBe(404);
  });
});

describe('GSTZen not configured', () => {
  beforeEach(() => {
    delete process.env.GSTZEN_USERNAME;
    delete process.env.GSTZEN_PASSWORD;
  });

  it('answers 503 with a plain message on every route that would call GSTZen', async () => {
    const r1 = await returns.POST(post('/api/gstzen/returns', { engagementId: OWN, form: 'gstr3b', period: '102026' }));
    expect(r1.status).toBe(503);
    expect((await r1.json()).error).toMatch(/not set up/);
    expect((await consent.POST(post('/api/gstzen/consent', { engagementId: OWN, audience: 'client' }))).status).toBe(503);
    expect((await gstinCheck.POST(post('/api/gstzen/gstin-check', { engagementId: OWN }))).status).toBe(503);
    results = [[otpRow({ audience: 'staff' })]];
    expect((await otp.POST(post(`/api/gstzen/otp/${REQ}`, { otp: '123456' }), params(REQ))).status).toBe(503);
    expect(api.generateOtp).not.toHaveBeenCalled();
    expect(api.establishSession).not.toHaveBeenCalled();
    expect(api.validateGstin).not.toHaveBeenCalled();
  });

  it('still answers the status read, with open: false', async () => {
    const res = await status.GET(get(`/api/gstzen/status?engagementId=${OWN}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ open: false, gstin: null });
  });
});

describe('a client types the consent OTP', () => {
  it('sends it to GSTZen and keeps it nowhere else', async () => {
    caller = client;
    const sessionRow = { gstin: '29AAFCC9980M1ZR', engagementId: OWN, status: 'active', expiresAt: new Date(1_800_000_000_000), establishedBy: 'client-1', establishedAt: new Date(), refreshedAt: null, updatedAt: new Date() };
    results = [[otpRow()], [sessionRow], []];
    const res = await clientAnswer.POST(post(`/api/client/agent-otp/${REQ}`, { otp: '482193' }), params(REQ));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purpose: 'gstn_consent' });
    expect(api.establishSession).toHaveBeenCalledWith('29AAFCC9980M1ZR', '482193');
    const written = JSON.stringify(calls.map((c) => [c.values, c.set]));
    expect(written).not.toContain('482193');
    expect(JSON.stringify(audit.mock.calls)).not.toContain('482193');
  });

  it('rejects anything but six digits before any read', async () => {
    caller = client;
    expect((await clientAnswer.POST(post(`/api/client/agent-otp/${REQ}`, { otp: '12ab' }), params(REQ))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('cannot answer a request addressed to staff', async () => {
    caller = client;
    results = [[otpRow({ audience: 'staff' })]];
    expect((await clientAnswer.POST(post(`/api/client/agent-otp/${REQ}`, { otp: '482193' }), params(REQ))).status).toBe(404);
    expect(api.establishSession).not.toHaveBeenCalled();
  });
});
