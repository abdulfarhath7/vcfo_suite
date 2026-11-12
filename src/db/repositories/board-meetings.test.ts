import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';

/**
 * Cross-tenant scoping for the board meetings repositories (docs/specs/board-meetings/PLAN.md):
 * a meeting of another firm's engagement reads as not found and writes nothing; a client never
 * reads a draft notice or an unlocked document; a lead cannot approve; a developer gets nothing
 * before any query; locked documents never change.
 */

type Call = { op: string; where?: SQL; values?: unknown; set?: unknown };
const calls: Call[] = [];
let results: unknown[][] = [];
function chain(call: Call): unknown {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'leftJoin', 'innerJoin', 'orderBy', 'limit', 'returning', 'onConflictDoNothing', 'onConflictDoUpdate']) c[m] = () => c;
  c.where = (w: SQL) => {
    call.where = w;
    return c;
  };
  c.values = (v: unknown) => {
    call.values = v;
    return c;
  };
  c.set = (v: unknown) => {
    call.set = v;
    return c;
  };
  c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(results.shift() ?? []).then(res, rej);
  return c;
}
const op = (name: string) => () => {
  const call: Call = { op: name };
  calls.push(call);
  return chain(call);
};
const db = { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') };
vi.mock('@/db/client', () => ({ db }));
vi.mock('server-only', () => ({}));
const putObject = vi.fn();
vi.mock('@/storage/s3', () => ({ bucketKey: (b: string, p: string) => `${b}/${p}`, putObject: (...a: unknown[]) => putObject(...a), signedDownloadUrl: vi.fn(async () => 'https://signed') }));

const assertEngagementAccess = vi.fn();
const listScopedEngagementIds = vi.fn();
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...a: unknown[]) => assertEngagementAccess(...a),
  listScopedEngagementIds: (...a: unknown[]) => listScopedEngagementIds(...a),
  checklistStateFromRow: () => ({}),
}));
vi.mock('@/db/repositories/notifications', () => ({ createNotificationsForUsers: vi.fn(async () => []) }));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn(async () => undefined) }));
// The proposed directors of Part B (`pre-15`), set per test.
let proposed: Array<{ id: string; index: number; values: Record<string, string> }> = [];
vi.mock('@/lib/incorporation/proposed-directors', () => ({
  readProposedDirectors: () => proposed,
  displayName: (v: Record<string, string>) => [v.firstName, v.lastName].filter(Boolean).join(' '),
}));

const repo = await import('@/db/repositories/board-meetings');
const dialect = new PgDialect();

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const MEETING = '33333333-3333-3333-3333-333333333303';
const DOC = '44444444-4444-4444-4444-444444444404';
const ctx = (role: AuthContext['role']): AuthContext => ({ userId: `user-${role}`, email: `${role}@vcfo.local`, name: role, role });
const paramsOf = (c: Call) => (c.where ? dialect.sqlToQuery(c.where).params : []);
const writes = () => calls.filter((c) => c.op !== 'select');
const meetingRow = (over: Record<string, unknown> = {}) => ({
  id: MEETING,
  engagementId: OTHER,
  kind: 'board',
  meetingType: 'quarterly',
  seq: 2,
  meetingNo: 'NIPL/BM/02/2026-27',
  meetingDate: '2026-09-10',
  meetingTime: '19:30',
  status: 'draft',
  version: 1,
  agenda: [],
  bodyOverride: null,
  recipients: [],
  sentAt: null,
  lockedAt: null,
  icsSequence: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  results = [];
  proposed = [];
});

describe('board meetings · stage gate (no meetings or directors before COI)', () => {
  const preCoi = { id: OWN, incorporationDate: null, stage: 'Pre-Incorporation' };
  const postCoi = { id: OWN, companyName: 'Nimbus Labs', incorporationDate: '2026-09-01', stage: 'Pre-Incorporation' };

  it('refuses a meeting for a company that is not incorporated, writing nothing', async () => {
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: preCoi });
    await expect(repo.createMeeting(ctx('manager'), { engagementId: OWN, meetingDate: '2026-09-10', meetingTime: '11:00', meetingType: 'first' })).rejects.toMatchObject({ status: 409, code: 'not_incorporated' });
    expect(writes()).toHaveLength(0);
  });

  it('refuses a meeting dated before the incorporation date, writing nothing', async () => {
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: postCoi });
    await expect(repo.createMeeting(ctx('intern'), { engagementId: OWN, meetingDate: '2026-08-20', meetingTime: '11:00' })).rejects.toMatchObject({ status: 422, code: 'before_incorporation' });
    expect(writes()).toHaveLength(0);
  });

  it('after COI a meeting on or after the incorporation date passes the gate and is inserted', async () => {
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: postCoi });
    // No query result for the insert, so the call stops at `create_failed` after the insert.
    await expect(repo.createMeeting(ctx('manager'), { engagementId: OWN, meetingDate: '2026-09-01', meetingTime: '11:00' })).rejects.toMatchObject({ code: 'create_failed' });
    expect(calls.some((c) => c.op === 'insert')).toBe(true);
  });

  it('refuses a reschedule to a date before the incorporation date', async () => {
    results = [[meetingRow({ engagementId: OWN, status: 'sent' })]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: postCoi });
    await expect(repo.rescheduleMeeting(ctx('intern'), MEETING, { meetingDate: '2026-08-01', meetingTime: '11:00', reason: 'x' })).rejects.toMatchObject({ status: 422, code: 'before_incorporation' });
    expect(writes()).toHaveLength(0);
  });

  it('before COI the directors list is empty, nothing is seeded, and adding a director is refused', async () => {
    proposed = [{ id: 'p1', index: 1, values: { firstName: 'Asha', lastName: 'Rao', din: '12345678' } }];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: preCoi });
    expect(await repo.listDirectors(ctx('manager'), OWN)).toEqual([]);
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: preCoi });
    await expect(repo.addDirector(ctx('manager'), OWN, { name: 'Asha Rao' })).rejects.toMatchObject({ status: 409, code: 'not_incorporated' });
    expect(calls).toHaveLength(0);
  });

  it('after COI the first read seeds the Part B directors appointed on the incorporation date', async () => {
    proposed = [{ id: 'p1', index: 1, values: { firstName: 'Asha', lastName: 'Rao', din: '1234 5678', officialMailId: 'asha@x.in' } }];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: postCoi });
    results = [[], []];
    await repo.listDirectors(ctx('manager'), OWN);
    const insert = calls.find((c) => c.op === 'insert');
    expect(insert?.values).toEqual([expect.objectContaining({ engagementId: OWN, name: 'Asha Rao', din: '12345678', appointedOn: '2026-09-01', source: 'incorporation' })]);
  });

  it('rows seeded before COI get the incorporation date and the Part B DIN on the next read, once', async () => {
    proposed = [{ id: 'p1', index: 1, values: { firstName: 'Asha', lastName: 'Rao', din: '12345678' } }];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: postCoi });
    results = [
      [
        { id: 'd1', name: 'asha  rao', din: null, appointedOn: null, source: 'incorporation' },
        { id: 'd2', name: 'Manual Person', din: null, appointedOn: null, source: 'manual' },
      ],
    ];
    await repo.listDirectors(ctx('manager'), OWN);
    const updates = calls.filter((c) => c.op === 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0]!.set).toMatchObject({ appointedOn: '2026-09-01', din: '12345678' });
    expect(calls.some((c) => c.op === 'insert')).toBe(false);

    // Already filled: the next read changes nothing.
    calls.length = 0;
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: postCoi });
    results = [[{ id: 'd1', name: 'Asha Rao', din: '12345678', appointedOn: '2026-09-01', source: 'incorporation' }]];
    await repo.listDirectors(ctx('manager'), OWN);
    expect(writes()).toHaveLength(0);
  });

  it('the reminders job skips meetings of companies that are not incorporated', async () => {
    const draftOwn = meetingRow({ id: 'm-own', engagementId: OWN, status: 'draft', meetingDate: '2026-09-05' });
    const draftOther = meetingRow({ id: 'm-other', engagementId: OTHER, status: 'draft', meetingDate: '2026-09-05' });
    results = [[draftOwn, draftOther], [postCoi, { id: OTHER, incorporationDate: null, stage: 'Pre-Incorporation' }]];
    expect((await repo.systemDraftsToPrepare('2026-09-01')).map((m) => m.id)).toEqual(['m-own']);

    const sentOwn = meetingRow({ id: 'm-own', engagementId: OWN, status: 'held', meetingDate: '2026-08-01' });
    const sentOther = meetingRow({ id: 'm-other', engagementId: OTHER, status: 'held', meetingDate: '2026-08-01' });
    results = [[sentOwn, sentOther], [postCoi, { id: OTHER, incorporationDate: null, stage: 'Pre-Incorporation' }], []];
    expect((await repo.systemMomOpen('2026-09-01')).map((r) => r.meeting.id)).toEqual(['m-own']);
  });
});

describe('board meetings · reads', () => {
  it('gives a developer nothing before any query', async () => {
    expect(await repo.listMeetings(ctx('developer' as AuthContext['role']))).toEqual([]);
    await expect(repo.getMeeting(ctx('developer' as AuthContext['role']), MEETING)).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(0);
  });

  it('a foreign engagement reads as not found for every role', async () => {
    for (const role of ['manager', 'intern', 'client'] as const) {
      calls.length = 0;
      results = [[meetingRow({ status: 'sent', sentAt: new Date() })]];
      assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: OTHER, forbidden: true });
      await expect(repo.getMeeting(ctx(role), MEETING)).rejects.toMatchObject({ status: 404 });
      expect(writes()).toHaveLength(0);
    }
  });

  it('a client never reads a draft or a meeting cancelled before sending', async () => {
    for (const row of [meetingRow({ engagementId: OWN }), meetingRow({ engagementId: OWN, status: 'cancelled', sentAt: null }), meetingRow({ engagementId: OWN, status: 'pending_approval' })]) {
      results = [[row]];
      assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: { id: OWN } });
      await expect(repo.getMeeting(ctx('client'), MEETING)).rejects.toMatchObject({ status: 404 });
    }
  });

  it('a manager lists only scoped engagements; none in scope means no query', async () => {
    listScopedEngagementIds.mockResolvedValueOnce([]);
    expect(await repo.listMeetings(ctx('manager'))).toEqual([]);
    expect(calls).toHaveLength(0);

    listScopedEngagementIds.mockResolvedValueOnce([OWN]);
    results = [[]];
    await repo.listMeetings(ctx('manager'));
    expect(paramsOf(calls[0]!)).toContain(OWN);
    expect(paramsOf(calls[0]!)).not.toContain(OTHER);
  });

  it('directors of a foreign engagement read as not found', async () => {
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: OTHER, forbidden: true });
    await expect(repo.listDirectors(ctx('intern'), OTHER)).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(0);
  });
});

describe('board meetings · writes', () => {
  it('creating a meeting on a foreign engagement writes nothing', async () => {
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: OTHER, forbidden: true });
    await expect(repo.createMeeting(ctx('intern'), { engagementId: OTHER, meetingDate: '2026-09-10', meetingTime: '19:30' })).rejects.toMatchObject({ status: 404 });
    expect(writes()).toHaveLength(0);
  });

  it('a client cannot create a meeting or add a director', async () => {
    await expect(repo.createMeeting(ctx('client'), { engagementId: OWN, meetingDate: '2026-09-10', meetingTime: '19:30' })).rejects.toMatchObject({ status: 403 });
    await expect(repo.addDirector(ctx('client'), OWN, { name: 'X' })).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(0);
  });

  it('a lead cannot approve or send back', async () => {
    await expect(repo.approveMeeting(ctx('intern'), MEETING)).rejects.toMatchObject({ status: 403 });
    await expect(repo.sendBackMeeting(ctx('intern'), MEETING, 'fix')).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });

  it('a lead cannot edit a notice that waits for approval; nobody edits a sent notice', async () => {
    results = [[meetingRow({ engagementId: OWN, status: 'pending_approval' })]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: { id: OWN } });
    await expect(repo.updateMeeting(ctx('intern'), MEETING, { venue: 'x' })).rejects.toMatchObject({ status: 403 });
    results = [[meetingRow({ engagementId: OWN, status: 'sent' })]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: { id: OWN } });
    await expect(repo.updateMeeting(ctx('manager'), MEETING, { venue: 'x' })).rejects.toMatchObject({ status: 409, code: 'notice_locked' });
    expect(writes()).toHaveLength(0);
  });

  it('approving a foreign meeting writes nothing, also for a super admin denied by scope', async () => {
    results = [[meetingRow({ status: 'pending_approval' })]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: false, dbId: OTHER, forbidden: true });
    await expect(repo.approveMeeting(ctx('manager'), MEETING)).rejects.toMatchObject({ status: 404 });
    expect(writes()).toHaveLength(0);
  });

  it('a locked document never changes and a client never uploads', async () => {
    await expect(repo.uploadSigned(ctx('client'), DOC, { name: 'a.pdf', type: 'application/pdf', bytes: new Uint8Array([1]) })).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(0);

    results = [[{ id: DOC, meetingId: MEETING, kind: 'mom', status: 'locked', signerIds: [] }], [meetingRow({ engagementId: OWN, status: 'held' })]];
    assertEngagementAccess.mockResolvedValue({ ok: true, dbId: OWN, row: { id: OWN } });
    await expect(repo.uploadSigned(ctx('intern'), DOC, { name: 'a.pdf', type: 'application/pdf', bytes: new Uint8Array([1]) })).rejects.toMatchObject({ status: 409, code: 'locked' });
    expect(writes()).toHaveLength(0);
    expect(putObject).not.toHaveBeenCalled();
    assertEngagementAccess.mockReset();
  });

  it('a client cannot open an unlocked document', async () => {
    results = [[{ id: DOC, meetingId: MEETING, kind: 'mom', status: 'sent', signerIds: [], fileKey: 'k' }], [meetingRow({ engagementId: OWN, status: 'held', sentAt: new Date() })]];
    assertEngagementAccess.mockResolvedValueOnce({ ok: true, dbId: OWN, row: { id: OWN } });
    await expect(repo.documentFileUrl(ctx('client'), DOC, 'signed')).rejects.toMatchObject({ status: 404 });
  });

  it('only a firm-wide admin edits the agenda library', async () => {
    for (const role of ['manager', 'intern', 'client'] as const) {
      await expect(repo.updateLibraryItem(ctx(role), 'BM-001', { wording: 'x' })).rejects.toMatchObject({ status: 403 });
    }
    await expect(repo.listLibrary(ctx('client'))).rejects.toMatchObject({ status: 404 });
    expect(calls).toHaveLength(0);
  });
});
