import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRole, AuthContext } from '@/auth/guards';
import type { ActionContext, ActionResult, AnyAction } from '../types';

/**
 * The board meeting actions: who sees each, which tier, that a card only reads, that everything runs
 * as the signed-in person on the locked client, and that code alone names the recipients. The
 * repository is mocked here, so a refused role is tested by the role lists and by its refusal.
 */
vi.mock('@/db/client', () => ({ db: {} }));

const CLIENT = 'a0000000-0000-4000-8000-00000000000a';
const OTHER = 'b0000000-0000-4000-8000-00000000000b';
const ID = 'd0000000-0000-4000-8000-00000000000d';
const DIRECTOR = 'e0000000-0000-4000-8000-00000000000e';
const DOC = 'f0000000-0000-4000-8000-00000000000f';

const allowed = { editNotice: true, submit: true, approve: true, reschedule: true, cancel: true, uploadMom: true, addResolution: true, remind: true };
const meeting = {
  id: ID,
  engagementId: CLIENT,
  meetingNo: 'NIPL/BM/3',
  kindLabel: 'Board meeting',
  typeLabel: 'Quarterly',
  meetingDate: '2026-12-15',
  meetingTime: '11:00',
  meetingType: 'quarterly',
  mode: 'vc',
  venue: 'Hyderabad',
  status: 'pending_approval',
  statusLabel: 'Waiting for approval',
  reviewNote: null,
  signatoryDirectorId: null,
  teamsLink: null,
  sentAt: null as string | null,
  dates: { shortNoticeIfSentToday: false },
  agenda: [
    { key: 'top', libraryId: 'BM-001', text: 'Chair', subs: [], fixed: 'top' },
    { key: 'k1', libraryId: null, text: 'Accounts', subs: [] },
  ],
  placeholders: [],
  directors: [{ id: DIRECTOR, name: 'Asha Rao', designation: 'Director', email: 'asha@x.test', current: true }, { id: 'gone', name: 'Old Hand', designation: 'Director', email: 'old@x.test', current: false }],
  recipients: [
    { kind: 'to', directorId: DIRECTOR, name: 'Asha Rao', email: 'asha@x.test', role: null },
    { kind: 'cc', directorId: null, name: 'Company secretary', email: 'cs@x.test', role: 'CS' },
    { kind: 'cc', directorId: null, name: 'No Email', email: null, role: null },
  ],
  replies: [{ directorId: DIRECTOR, name: 'Asha Rao', reply: null, note: null }],
  quorum: { state: 'ok' },
  documents: [{ id: DOC, kind: 'resolution', title: 'Open a bank account', description: 'Old text', status: 'draft', signerIds: [DIRECTOR], signers: [{ id: DIRECTOR, name: 'Asha Rao', state: 'not_sent' }] }],
  lead: { id: 'l', name: 'Lead Person' },
  manager: { id: 'm', name: 'Manager Person' },
  can: allowed,
};

const repo = vi.hoisted(() => ({
  listMeetings: vi.fn(),
  getMeeting: vi.fn(),
  createMeeting: vi.fn(),
  updateMeeting: vi.fn(),
  submitMeeting: vi.fn(),
  approveMeeting: vi.fn(),
  sendBackMeeting: vi.fn(),
  rescheduleMeeting: vi.fn(),
  cancelMeeting: vi.fn(),
  createResolution: vi.fn(),
  updateResolution: vi.fn(),
  markSentForSignature: vi.fn(),
  systemDocument: vi.fn(),
  systemMeetingBundle: vi.fn(),
  systemMeetingPeople: vi.fn(),
}));
vi.mock('@/db/repositories/board-meetings', async () => {
  const { BoardMeetingError } = await vi.importActual<typeof import('@/db/repositories/board-meetings/shared')>('@/db/repositories/board-meetings/shared');
  return { ...repo, BoardMeetingError };
});
const send = vi.hoisted(() => ({ sendNotice: vi.fn(), sendCancellation: vi.fn(), sendForSignature: vi.fn(), remindNonResponders: vi.fn() }));
vi.mock('@/lib/board-meetings/send', () => send);
const afterQueue = vi.hoisted(() => [] as Array<() => Promise<unknown>>);
vi.mock('next/server', async () => ({ ...(await vi.importActual<typeof import('next/server')>('next/server')), after: (fn: () => Promise<unknown>) => afterQueue.push(fn) }));

const { BoardMeetingError } = await import('@/db/repositories/board-meetings/shared');
const { actions } = await import('./index');
const { refusing } = await import('../shared');

const byName = (name: string) => actions.find((a: AnyAction) => a.name === name)!;
const person = (role: AppRole): AuthContext => ({ userId: 'u1', email: 'u@x.test', name: 'U', role });
const actx = (role: AppRole = 'manager', engagementId: string | null = CLIENT): ActionContext => ({ auth: person(role), engagementId, conversationId: null, runId: 'r', now: new Date('2026-11-06T10:00:00Z'), via: 'ask' });

const STAFF = ['super_admin', 'admin', 'manager', 'intern'];
const MANAGING = ['super_admin', 'admin', 'manager'];
const resolution = { title: 'Open a bank account', description: 'Resolved to open one.', resolutionDate: '2026-12-16' };
const TABLE: Array<[string, string, string[], object]> = [
  ['board-meetings.list', 'T0', STAFF, {}],
  ['board-meetings.get', 'T0', STAFF, { meetingId: ID }],
  ['board-meetings.create', 'T2', STAFF, { meetingDate: '2026-12-15', meetingTime: '11:00' }],
  ['board-meetings.editNotice', 'T2', STAFF, { meetingId: ID, venue: 'Mumbai' }],
  ['board-meetings.submit', 'T2', STAFF, { meetingId: ID }],
  ['board-meetings.approve', 'T3', MANAGING, { meetingId: ID }],
  ['board-meetings.sendBack', 'T3', MANAGING, { meetingId: ID, note: 'Fix the venue' }],
  ['board-meetings.reschedule', 'T3', STAFF, { meetingId: ID, meetingDate: '2026-12-20', meetingTime: '10:00' }],
  ['board-meetings.cancel', 'T3', STAFF, { meetingId: ID }],
  ['board-meetings.remindDirectors', 'T3', STAFF, { meetingId: ID }],
  ['board-meetings.addResolution', 'T2', STAFF, { meetingId: ID, ...resolution }],
  ['board-meetings.editResolution', 'T2', STAFF, { documentId: DOC, ...resolution }],
  ['board-meetings.sendForSignature', 'T3', STAFF, { documentId: DOC }],
];
const undoFrom = (outcome: ActionResult) => (outcome.ok ? outcome.undo! : null);
const needsCard = (a: AnyAction) => a.tier === 'T2' || a.tier === 'T3';
const writes = [repo.createMeeting, repo.updateMeeting, repo.submitMeeting, repo.approveMeeting, repo.sendBackMeeting, repo.rescheduleMeeting, repo.cancelMeeting, repo.createResolution, repo.updateResolution, repo.markSentForSignature, send.sendNotice, send.sendCancellation, send.sendForSignature, send.remindNonResponders];

beforeEach(() => {
  vi.clearAllMocks();
  afterQueue.length = 0;
  repo.listMeetings.mockResolvedValue([{ id: ID, meetingNo: 'NIPL/BM/3', statusLabel: 'Draft', resolutions: { locked: 0, open: 0 } }]);
  repo.getMeeting.mockResolvedValue(meeting);
  repo.createMeeting.mockResolvedValue({ ...meeting, id: ID });
  repo.updateMeeting.mockResolvedValue(meeting);
  repo.submitMeeting.mockResolvedValue(meeting);
  repo.approveMeeting.mockResolvedValue({ id: ID, rescheduledFrom: null, sentAt: null });
  repo.sendBackMeeting.mockResolvedValue(meeting);
  repo.rescheduleMeeting.mockResolvedValue(meeting);
  repo.cancelMeeting.mockResolvedValue({ before: { sentAt: null }, after: {} });
  repo.createResolution.mockResolvedValue({ title: 'T' });
  repo.updateResolution.mockResolvedValue({ title: 'T' });
  repo.markSentForSignature.mockResolvedValue({ doc: { id: DOC, meetingId: ID } });
  repo.systemDocument.mockResolvedValue({ id: DOC, meetingId: ID });
  repo.systemMeetingBundle.mockResolvedValue({ engagement: {} });
  repo.systemMeetingPeople.mockResolvedValue({ lead: { id: 'l', name: 'L', email: 'l@x.test' }, manager: { id: 'm' } });
  send.sendNotice.mockResolvedValue({ sent: true });
  send.sendForSignature.mockResolvedValue(1);
  send.remindNonResponders.mockResolvedValue(1);
});

describe('the board meeting actions', () => {
  it('holds exactly the actions in the table, with that tier and those roles', () => {
    expect(actions.map((a: AnyAction) => a.name).sort()).toEqual(TABLE.map(([name]) => name).sort());
    for (const [name, tier, roles] of TABLE) {
      expect(byName(name).tier, name).toBe(tier);
      expect([...byName(name).roles].sort(), name).toEqual([...roles].sort());
    }
  });

  it('never offers an action to a client, a developer or a partner, and keeps approval from a project lead', () => {
    for (const action of actions) for (const role of ['client', 'developer', 'partner']) expect(action.roles).not.toContain(role);
    for (const name of ['board-meetings.approve', 'board-meetings.sendBack']) expect(byName(name).roles).not.toContain('intern');
  });

  it.each(TABLE)('%s takes no client, recipient or signer in its input', (name, _tier, _roles, input) => {
    const parsed = byName(name).input.safeParse({ ...input, engagementId: OTHER, recipients: ['x@evil.test'], signerIds: [OTHER] });
    expect(parsed.success).toBe(true);
    const text = JSON.stringify(parsed.data);
    for (const planted of [OTHER, 'x@evil.test']) expect(text).not.toContain(planted);
  });

  it.each(TABLE.filter(([name]) => needsCard(byName(name))))('%s only prepares a card on preview, and writes nothing', async (name, _tier, _roles, input) => {
    const action = byName(name);
    const draft = await action.preview(actx(), action.input.parse(input));
    expect(draft!.engagementId).toBe(CLIENT);
    expect(draft!.tier).toBe(action.tier);
    expect(draft!.rows).toHaveLength(1);
    expect(draft!.rows[0]!.action).toBe(name);
    if (action.tier === 'T3') expect(Array.isArray(draft!.recipients)).toBe(true);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(action.input.safeParse({ ...draft!.rows[0]!.target, value: draft!.rows[0]!.newValue }).success, name).toBe(true);
  });

  it.each(TABLE)('%s runs as the person, on the locked client', async (name, _tier, _roles, input) => {
    const action = byName(name);
    const outcome = await action.execute(actx(), action.input.parse(input));
    expect(outcome.ok, `${name}: ${JSON.stringify(outcome)}`).toBe(true);
    const calls = [repo.listMeetings, repo.getMeeting, repo.createMeeting].flatMap((fn) => fn.mock.calls);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect((call[0] as AuthContext).userId).toBe('u1');
  });

  it('needs a locked client for everything', async () => {
    repo.getMeeting.mockResolvedValue({ ...meeting, engagementId: CLIENT });
    for (const [name, , , input] of TABLE) {
      const action = byName(name);
      const parsed = action.input.parse(input);
      const outcome = needsCard(action)
        ? await refusing(async () => {
            await action.preview(actx('manager', null), parsed);
            return { ok: true, summary: '' };
          })
        : await action.execute(actx('manager', null), parsed);
      expect(outcome.ok, name).toBe(false);
    }
  });

  it('refuses a meeting or document on another client, as if it were not there', async () => {
    repo.getMeeting.mockResolvedValue({ ...meeting, engagementId: OTHER });
    for (const [name, , , input] of TABLE.filter(([n]) => n !== 'board-meetings.list' && n !== 'board-meetings.create')) {
      const action = byName(name);
      const outcome = await action.execute(actx(), action.input.parse(input));
      expect(outcome, name).toEqual({ ok: false, error: expect.stringMatching(/not on this project/) });
      await expect(needsCard(action) ? action.preview(actx(), action.input.parse(input)) : Promise.reject(new Error('not on this project'))).rejects.toThrow(/not on this project/);
    }
    for (const write of writes) expect(write).not.toHaveBeenCalled();
  });

  it('turns a repository refusal into a sentence, and leaves a fault as a fault', async () => {
    repo.submitMeeting.mockRejectedValueOnce(new BoardMeetingError(400, 'blank_fields'));
    expect(await byName('board-meetings.submit').execute(actx(), { meetingId: ID })).toEqual({ ok: false, error: 'The agenda still has blank fields to fill in.' });
    repo.submitMeeting.mockRejectedValueOnce(new BoardMeetingError(409, 'some_new_code'));
    expect(await byName('board-meetings.submit').execute(actx(), { meetingId: ID })).toEqual({ ok: false, error: 'That could not be done on this meeting.' });
    repo.submitMeeting.mockRejectedValueOnce(new Error('database down'));
    await expect(byName('board-meetings.submit').execute(actx(), { meetingId: ID })).rejects.toThrow('database down');
  });

  it('refuses on the card what the meeting page would not offer', async () => {
    repo.getMeeting.mockResolvedValue({ ...meeting, can: { ...allowed, approve: false, submit: false, editNotice: false, reschedule: false, cancel: false, remind: false, addResolution: false } });
    for (const [name, , , input] of TABLE.filter(([n]) => ['board-meetings.approve', 'board-meetings.sendBack', 'board-meetings.submit', 'board-meetings.editNotice', 'board-meetings.reschedule', 'board-meetings.cancel', 'board-meetings.remindDirectors', 'board-meetings.addResolution'].includes(n))) {
      const action = byName(name);
      await expect(action.preview(actx(), action.input.parse(input)), name).rejects.toThrow();
    }
  });

  it('names everyone with an address from the meeting, never from the input', async () => {
    const draft = await byName('board-meetings.approve').preview(actx(), { meetingId: ID });
    expect(draft!.recipients).toEqual([
      { name: 'Asha Rao', email: 'asha@x.test', role: 'Director' },
      { name: 'Company secretary', email: 'cs@x.test', role: 'Copied' },
    ]);
  });

  it('tells nobody about a cancelled meeting whose notice never went', async () => {
    expect((await byName('board-meetings.cancel').preview(actx(), { meetingId: ID }))!.recipients).toEqual([]);
    repo.getMeeting.mockResolvedValue({ ...meeting, sentAt: '2026-11-01T00:00:00Z' });
    expect((await byName('board-meetings.cancel').preview(actx(), { meetingId: ID }))!.recipients).toHaveLength(2);
  });

  it('reminds only the directors who have not replied, and stops when all have', async () => {
    const draft = await byName('board-meetings.remindDirectors').preview(actx(), { meetingId: ID });
    expect(draft!.recipients).toEqual([{ name: 'Asha Rao', email: 'asha@x.test', role: 'Director' }]);
    repo.getMeeting.mockResolvedValue({ ...meeting, replies: [{ directorId: DIRECTOR, name: 'Asha Rao', reply: 'yes', note: null }] });
    await expect(byName('board-meetings.remindDirectors').preview(actx(), { meetingId: ID })).rejects.toThrow(/has replied/);
  });

  it('approves first and sends the notice only after the answer', async () => {
    const outcome = await byName('board-meetings.approve').execute(actx(), { meetingId: ID });
    expect(outcome.ok).toBe(true);
    expect(repo.approveMeeting).toHaveBeenCalledWith(person('manager'), ID);
    expect(send.sendNotice).not.toHaveBeenCalled();
    await afterQueue.shift()!();
    expect(send.sendNotice).toHaveBeenCalledWith(ID, { leadId: 'l', notifyIds: ['l', 'm', 'u1'], update: false });
  });

  it('has every current director sign a new resolution, whatever the model says', async () => {
    await byName('board-meetings.addResolution').execute(actx(), { meetingId: ID, ...resolution, signerIds: [OTHER] });
    expect(repo.createResolution.mock.calls[0]![2].signerIds).toEqual([DIRECTOR]);
    await byName('board-meetings.editResolution').execute(actx(), { documentId: DOC, ...resolution });
    expect(repo.updateResolution.mock.calls[0]![2].signerIds).toEqual([DIRECTOR]);
  });

  it('leaves a locked resolution alone', async () => {
    repo.getMeeting.mockResolvedValue({ ...meeting, documents: [{ ...meeting.documents[0], status: 'locked' }] });
    await expect(byName('board-meetings.editResolution').preview(actx(), { documentId: DOC, ...resolution })).rejects.toThrow(/locked/);
    await expect(byName('board-meetings.sendForSignature').preview(actx(), { documentId: DOC })).rejects.toThrow(/locked/);
  });

  it('adds and removes agenda items, keeping the fixed ones', async () => {
    await byName('board-meetings.editNotice').execute(actx(), { meetingId: ID, addAgendaItems: ['Auditor appointment'], removeAgendaKeys: ['k1', 'top'] });
    const { agenda } = repo.updateMeeting.mock.calls[0]![2];
    expect(agenda.map((a: { text: string }) => a.text)).toEqual(['Chair', 'Auditor appointment']);
    await expect(byName('board-meetings.editNotice').preview(actx(), { meetingId: ID })).rejects.toThrow(/nothing to change/);
  });

  it('undoes a new draft and a notice edit, but not a draft that has moved on', async () => {
    const created = byName('board-meetings.create');
    const made = await created.execute(actx(), { meetingDate: '2026-12-15', meetingTime: '11:00' });
    expect(made).toMatchObject({ ok: true, undo: { meetingId: ID } });
    expect((await created.undo!(actx(), { meetingId: ID })).ok).toBe(false);
    expect(repo.cancelMeeting).not.toHaveBeenCalled();
    repo.getMeeting.mockResolvedValue({ ...meeting, status: 'draft' });
    expect((await created.undo!(actx(), { meetingId: ID })).ok).toBe(true);
    expect(repo.cancelMeeting).toHaveBeenCalled();

    const edit = byName('board-meetings.editNotice');
    const edited = await edit.execute(actx(), { meetingId: ID, venue: 'Mumbai' });
    expect(edited).toMatchObject({ ok: true, undo: { meetingId: ID, venue: 'Hyderabad' } });
    expect((await edit.undo!(actx(), undoFrom(edited))).ok).toBe(true);
    expect(repo.updateMeeting.mock.calls[1]![2]).toMatchObject({ venue: 'Hyderabad' });
  });
});
