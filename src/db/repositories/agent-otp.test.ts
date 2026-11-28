import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect, getTableConfig } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';
import { agentOtpRequests, gstnSessions } from '@/db/schema';

/**
 * AGENT OTP REQUESTS (decision B7: an OTP is never stored). The table has no OTP column, the
 * repository writes none, and no repository function takes one. Scope: staff on the engagement;
 * a client lists and answers only requests addressed to the client on their own engagement; an
 * expired request answers 410.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
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
    set: (s: unknown) => {
      call.set = s;
      return c;
    },
    where: (w: SQL) => {
      call.where = w;
      return c;
    },
    values: (v: unknown) => {
      call.values = v;
      return c;
    },
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

const listScopedEngagementIds = vi.fn();
const assertEngagementAccess = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  checklistStateFromRow: () => ({}),
}));

const repo = await import('@/db/repositories/agent-otp');
const sessions = await import('@/db/repositories/gstn-sessions');

const dialect = new PgDialect();
const OWN = '11111111-1111-4111-8111-111111111101';
const OTHER = '22222222-2222-4222-8222-222222222202';
const REQ = '33333333-3333-4333-8333-333333333303';
const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `user-${role}`, email: `${role}@x.test`, name: role, role, ...(role === 'intern' ? { internId: 'i-1' } : {}) });

const row = (over: Record<string, unknown> = {}) => ({
  id: REQ,
  engagementId: OWN,
  purpose: 'gstn_consent',
  subjectType: 'gstn_session',
  subjectId: '29AAFCC9980M1ZR',
  gstin: '29AAFCC9980M1ZR',
  sentTo: 'the mobile registered on the GST portal',
  audience: 'client',
  status: 'pending',
  requestedBy: 'user-intern',
  requestedAt: new Date('2026-11-26T10:00:00Z'),
  answeredBy: null,
  answeredAt: null,
  expiresAt: new Date('2026-11-26T10:10:00Z'),
  ...over,
});

beforeEach(() => {
  calls.length = 0;
  results = [];
  vi.clearAllMocks();
  assertEngagementAccess.mockImplementation(async (_c: AuthContext, id: string) => (id === OWN ? { ok: true, dbId: OWN, row: { id: OWN, companyName: 'Kestrel' } } : { ok: false, dbId: id, forbidden: true }));
  listScopedEngagementIds.mockResolvedValue([OWN]);
});

describe('no OTP is ever stored', () => {
  it('has no OTP column in the OTP request or GSTN session tables', () => {
    for (const t of [agentOtpRequests, gstnSessions]) {
      const names = getTableConfig(t).columns.map((c) => c.name);
      expect(names.filter((n) => /(^|_)(otp|code|token|password|secret)($|_)/i.test(n))).toEqual([]);
    }
  });

  it('creates a request with only its fields, ten minutes long', async () => {
    const now = new Date('2026-11-26T10:00:00Z');
    results = [[], [row({ audience: 'staff' })], []];
    const view = await repo.createOtpRequest(
      ctx('intern'),
      { engagementId: OWN, purpose: 'gstn_consent', subjectType: 'gstn_session', subjectId: 'G', gstin: 'G', sentTo: 'mobile', audience: 'staff' },
      now,
    );
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(Object.keys(insert.values as object).sort()).toEqual(['audience', 'engagementId', 'expiresAt', 'gstin', 'purpose', 'requestedAt', 'requestedBy', 'sentTo', 'status', 'subjectId', 'subjectType']);
    expect((insert.values as { expiresAt: Date }).expiresAt.toISOString()).toBe('2026-11-26T10:10:00.000Z');
    expect(JSON.stringify(view)).not.toMatch(/"otp"/i);
  });

  it('records an answer as who and when only', async () => {
    await repo.markOtpAnswered(ctx('client'), REQ, new Date('2026-11-26T10:01:00Z'));
    const upd = calls.find((c) => c.op === 'update')!;
    expect(Object.keys(upd.set as object).sort()).toEqual(['answeredAt', 'answeredBy', 'status']);
  });

  it('takes no OTP argument anywhere in its API', () => {
    // markOtpAnswered(ctx, id, now?), loadOtpRequestForAnswer(ctx, id, now?): no slot for a value.
    expect(repo.markOtpAnswered.length).toBeLessThanOrEqual(2);
    expect(repo.loadOtpRequestForAnswer.length).toBeLessThanOrEqual(2);
    expect(Object.keys(repo).some((k) => /otp(value|code)|withotp/i.test(k))).toBe(false);
  });
});

describe('scope', () => {
  it('refuses a client on the staff create and list', async () => {
    await expect(repo.createOtpRequest(ctx('client'), { engagementId: OWN, purpose: 'evc', subjectType: 'gst_return_run', subjectId: 'r', gstin: 'G', sentTo: null, audience: 'client' })).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });

  it('refuses staff on an engagement out of their scope', async () => {
    await expect(repo.listOtpRequestsFor(ctx('intern'), { engagementId: OTHER, subjectType: 'gst_return_run', subjectId: 'r' })).rejects.toMatchObject({ status: 403 });
    expect(calls.filter((c) => c.op !== 'select' || c.where)).toHaveLength(0);
  });

  it('lists a client only their own client-audience requests', async () => {
    results = [[{ r: row() }]];
    const out = await repo.listMyPendingOtpRequests(ctx('client'), new Date('2026-11-26T10:02:00Z'));
    expect(out).toHaveLength(1);
    const sql = dialect.sqlToQuery(calls[0].where!);
    expect(sql.params).toContain(OWN);
    expect(sql.params).not.toContain(OTHER);
    expect(sql.params).toContain('client');
    await expect(repo.listMyPendingOtpRequests(ctx('intern'))).rejects.toMatchObject({ status: 403 });
  });

  it('lets a client answer only a request addressed to the client', async () => {
    results = [[row({ audience: 'staff' })]];
    await expect(repo.loadOtpRequestForAnswer(ctx('client'), REQ, new Date('2026-11-26T10:02:00Z'))).rejects.toMatchObject({ status: 404 });
    results = [[row({ engagementId: OTHER })]];
    await expect(repo.loadOtpRequestForAnswer(ctx('client'), REQ, new Date('2026-11-26T10:02:00Z'))).rejects.toMatchObject({ status: 404 });
    results = [[row()]];
    await expect(repo.loadOtpRequestForAnswer(ctx('client'), REQ, new Date('2026-11-26T10:02:00Z'))).resolves.toMatchObject({ id: REQ });
  });

  it('lets staff answer either audience on their engagement, and marks an expired request', async () => {
    results = [[row()]];
    await expect(repo.loadOtpRequestForAnswer(ctx('intern'), REQ, new Date('2026-11-26T10:02:00Z'))).resolves.toMatchObject({ id: REQ });
    results = [[row()]];
    await expect(repo.loadOtpRequestForAnswer(ctx('intern'), REQ, new Date('2026-11-26T10:11:00Z'))).rejects.toMatchObject({ status: 410 });
    expect(calls.some((c) => c.op === 'update' && (c.set as { status?: string }).status === 'expired')).toBe(true);
    results = [[row({ status: 'answered' })]];
    await expect(repo.loadOtpRequestForAnswer(ctx('intern'), REQ, new Date('2026-11-26T10:02:00Z'))).rejects.toMatchObject({ status: 409 });
  });
});

describe('GSTN sessions', () => {
  it('stores status and expiry only', async () => {
    // Relative to now, so the session is still in the future whenever the test runs.
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    results = [[{ gstin: 'G', engagementId: OWN, status: 'active', expiresAt, establishedBy: 'user-client', establishedAt: new Date(), refreshedAt: null, updatedAt: new Date() }]];
    const v = await sessions.recordGstnSessionEstablished(ctx('client'), { engagementId: OWN, gstin: 'G', expiresAt });
    expect(v.status).toBe('active');
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(Object.keys(insert.values as object).sort()).toEqual(['engagementId', 'establishedAt', 'establishedBy', 'expiresAt', 'gstin', 'refreshedAt', 'status']);
  });

  it('refuses a client on the staff session read', async () => {
    await expect(sessions.getEngagementGstnSession(ctx('client'), OWN)).rejects.toMatchObject({ status: 403 });
  });
});
