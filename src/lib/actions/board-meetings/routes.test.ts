import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The routes that moved to the shared functions answer as before. Repository and email are mocked. */

const guard = vi.hoisted(() => vi.fn());
const repo = vi.hoisted(() => ({
  getMeeting: vi.fn(),
  approveMeeting: vi.fn(),
  cancelMeeting: vi.fn(),
  markSentForSignature: vi.fn(),
  systemMeetingBundle: vi.fn(),
  systemMeetingPeople: vi.fn(),
}));
const send = vi.hoisted(() => ({ sendNotice: vi.fn(), sendCancellation: vi.fn(), sendForSignature: vi.fn(), remindNonResponders: vi.fn() }));
const afterQueue = vi.hoisted(() => [] as Array<() => Promise<unknown>>);
vi.mock('next/server', async () => ({ ...(await vi.importActual<typeof import('next/server')>('next/server')), after: (fn: () => Promise<unknown>) => afterQueue.push(fn) }));
vi.mock('@/auth/guards', () => ({ requireAnyRole: () => guard() }));
vi.mock('@/db/repositories/board-meetings', async () => {
  const { BoardMeetingError } = await vi.importActual<typeof import('@/db/repositories/board-meetings/shared')>('@/db/repositories/board-meetings/shared');
  return { ...repo, BoardMeetingError };
});
vi.mock('@/lib/board-meetings/send', () => send);

const { BoardMeetingError } = await import('@/db/repositories/board-meetings/shared');
const approve = (await import('../../../../app/api/board-meetings/[id]/approve/route')).POST;
const cancel = (await import('../../../../app/api/board-meetings/[id]/cancel/route')).POST;
const remind = (await import('../../../../app/api/board-meetings/[id]/remind/route')).POST;
const signature = (await import('../../../../app/api/board-meetings/documents/[docId]/send/route')).POST;

const params = { params: Promise.resolve({ id: 'm1' }) };
const post = (body?: unknown) => new Request('http://x/api?reminder=1', { method: 'POST', body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.clearAllMocks();
  afterQueue.length = 0;
  guard.mockResolvedValue({ ok: true, ctx: { userId: 'u1', email: 'u@x.test', name: 'U', role: 'manager' } });
  repo.getMeeting.mockResolvedValue({ id: 'm1', can: { remind: true }, replies: [{ directorId: 'd1', reply: 'yes' }, { directorId: 'd2', reply: null }] });
  repo.approveMeeting.mockResolvedValue({ id: 'm1', rescheduledFrom: '2026-12-01', sentAt: null });
  repo.cancelMeeting.mockResolvedValue({ before: { sentAt: new Date() }, after: {} });
  repo.markSentForSignature.mockResolvedValue({ doc: { id: 'doc1', meetingId: 'm1' } });
  repo.systemMeetingBundle.mockResolvedValue({ engagement: {} });
  repo.systemMeetingPeople.mockResolvedValue({ lead: { id: 'l', name: 'L', email: 'l@x.test' }, manager: { id: 'm' } });
  send.sendNotice.mockResolvedValue({ sent: true });
  send.remindNonResponders.mockResolvedValue(1);
  send.sendForSignature.mockResolvedValue(2);
});

describe('board meeting routes', () => {
  it('refuses a role the guard refuses, before anything else', async () => {
    guard.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    expect((await approve(post(), params)).status).toBe(403);
    expect(repo.approveMeeting).not.toHaveBeenCalled();
  });

  it('approve answers once saved, marks a rescheduled notice as an update, and sends after the answer', async () => {
    const res = await approve(post(), params);
    expect(await res.json()).toMatchObject({ queued: true, meeting: { id: 'm1' } });
    expect(send.sendNotice).not.toHaveBeenCalled();
    await afterQueue.shift()!();
    expect(send.sendNotice).toHaveBeenCalledWith('m1', { leadId: 'l', notifyIds: ['l', 'm', 'u1'], update: true });
  });

  it('approve keeps the repository code and status', async () => {
    repo.approveMeeting.mockRejectedValueOnce(new BoardMeetingError(409, 'not_pending'));
    const res = await approve(post(), params);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_pending' });
  });

  it('cancel tells whoever it told before', async () => {
    expect((await cancel(post({ reason: 'Quorum' }), params)).status).toBe(200);
    expect(repo.cancelMeeting).toHaveBeenCalledWith(expect.anything(), 'm1', 'Quorum');
    expect(send.sendCancellation).toHaveBeenCalledWith('m1', { leadId: 'l', notifyIds: ['l', 'm'], wasSent: true });
  });

  it('remind counts only the ones who replied as done, and says not_sent before the notice is out', async () => {
    expect(await (await remind(post(), params)).json()).toEqual({ sent: 1 });
    expect(send.remindNonResponders).toHaveBeenCalledWith('m1', ['d1']);
    repo.getMeeting.mockResolvedValue({ id: 'm1', can: { remind: false }, replies: [] });
    const res = await remind(post(), params);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_sent' });
  });

  it('send for signature passes the reminder flag and the lead', async () => {
    const res = await signature(post(), { params: Promise.resolve({ docId: 'doc1' }) });
    expect(await res.json()).toMatchObject({ sent: 2, meeting: { id: 'm1' } });
    expect(repo.markSentForSignature).toHaveBeenCalledWith(expect.anything(), 'doc1', true);
    expect(send.sendForSignature).toHaveBeenCalledWith('doc1', { lead: { id: 'l', name: 'L', email: 'l@x.test' }, reminder: true });
  });
});
