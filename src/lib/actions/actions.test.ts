import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRole, AuthContext } from '@/auth/guards';
import type { ActionContext, AnyAction } from './types';

/**
 * Every action: who may see it, which tier, and that a person's input goes to the screen's own
 * repository, on the locked client only. The repositories keep their own role tests; these check
 * that the actions call them as the signed-in person and turn a refusal into a sentence.
 */
vi.mock('@/db/client', () => ({ db: {} }));

const CLIENT = 'a0000000-0000-4000-8000-00000000000a';
const OTHER = 'b0000000-0000-4000-8000-00000000000b';
const ID = 'd0000000-0000-4000-8000-00000000000d';

const task = { id: ID, engagementId: CLIENT, title: 'Board minutes', stageLabel: 'In progress', owner: { id: 'o', name: 'Owner' }, reviewer: null, can: {}, checklistItems: [], comments: [], startDate: '2026-11-01', dueDate: '2026-12-01', urgency: 'Medium', visibility: 'firm', reviewNote: null };
class Refusal extends Error {
  constructor(readonly status: number, code: string) {
    super(code);
  }
}
const tasksRepo = {
  listTasks: vi.fn(async () => ({ tasks: [task], today: '2026-11-06' })),
  getTask: vi.fn(async () => task as typeof task),
  createTask: vi.fn(async () => task),
  changeTaskStage: vi.fn(async () => task),
  editTask: vi.fn(async () => task),
  reviewTask: vi.fn(async () => task),
  addChecklistItem: vi.fn(async () => ({ label: 'Line' })),
  addTaskComment: vi.fn(async () => ({})),
  taskCommentAudience: vi.fn(async () => ({ clientSees: true, people: [{ name: 'Owner', email: 'o@x.test', role: 'intern' }, { name: 'Client Person', email: 'c@x.test', role: 'client' }] })),
};
vi.mock('@/db/repositories/compliance-tasks', () => tasksRepo);
const workRepo = { addChecklistItem: vi.fn(async () => ({ id: 'w1', label: 'Mine' }) as { id: string; label: string } | null), deleteChecklistItem: vi.fn(async () => true) };
vi.mock('@/db/repositories/work-checklist', () => workRepo);
const requestsRepo = { createAndNotifyDocumentRequest: vi.fn(async () => ({ request: { label: 'Rent' }, email: {} })) };
vi.mock('@/lib/requests/create-document-request', () => requestsRepo);
const clientDocs = { setDocumentRequestDetails: vi.fn(async () => true) };
vi.mock('@/db/repositories/client-documents', () => clientDocs);
const document = { id: ID, engagementId: CLIENT, fileName: 'notice.txt', objectKey: 'engagement-documents/x/notice.txt', contentType: 'text/plain', reviewStatus: 'pending', reviewedAt: null as string | null, uploadedByName: 'Up Loader' };
const docsRepo = {
  listVaultRequests: vi.fn(async () => [{ id: ID, title: 'Rent', status: 'pending', dueOn: null, files: [] }]),
  listDocuments: vi.fn(async () => [document]),
  getDocumentById: vi.fn(async () => document as typeof document | null),
  setDocumentReview: vi.fn(async () => document),
  deleteVaultDocument: vi.fn(async () => document),
  restoreVaultDocument: vi.fn(async () => document),
};
vi.mock('@/db/repositories/documents', () => docsRepo);
const reminders = { resolveReminderTarget: vi.fn(async () => ({ ok: true, target: { itemTitle: 'Rent' } }) as unknown), lastReminderWithinWindow: vi.fn(async () => null as Date | null) };
vi.mock('@/db/repositories/client-reminders', () => reminders);
const send = { sendClientReminder: vi.fn(async () => ({ ok: true, channels: ['email'] }) as unknown) };
vi.mock('@/lib/reminders/send-client-reminder', () => send);
vi.mock('@/db/repositories/engagement-recipients', () => ({ resolveEngagementRecipients: async () => ({ clients: [{ userId: 'c', name: 'Client Person', email: 'c@x.test' }] }) }));
const filing = { id: ID, particular: 'GSTR-3B', compliance: 'GST', periodLabel: 'Oct', dueDate: '2026-11-20', filedOn: null };
const filingsRepo = { getFilings: vi.fn(async () => ({ rows: [filing], companies: [] })) };
vi.mock('@/db/repositories/filings', () => filingsRepo);
const filingStatusRepo = { markFilingFiled: vi.fn(async () => ({})), reopenFiling: vi.fn(async () => ({})), FilingStatusError: class extends Error {} };
vi.mock('@/db/repositories/filing-status', () => filingStatusRepo);
const engagementsRepo = { getEngagementById: vi.fn(async () => ({ companyName: 'Acme', stage: 'Pre-Incorporation' })), checklistStateFromRow: () => ({}) };
vi.mock('@/db/repositories/engagements', () => engagementsRepo);
const notesRepo = { NOTE_MAX_LENGTH: 4000, listEngagementNotes: vi.fn(async () => [{ id: ID, authorName: 'A', createdAt: 'x', pinned: false, body: 'Note body' }]), createEngagementNote: vi.fn(async () => ({})), deleteEngagementNote: vi.fn(async () => undefined) };
vi.mock('@/db/repositories/engagement-notes', () => notesRepo);
const storage = { getObjectBuffer: vi.fn(async () => Buffer.from('PAN ABCDE1234F in this notice.') as Buffer | null) };
vi.mock('@/storage/s3', () => storage);

const { actions: taskActions } = await import('./tasks');
const { actions: requestActions } = await import('./requests');
const { actions: reminderActions } = await import('./reminders');
const { actions: documentActions } = await import('./documents');
const { actions: statusActions } = await import('./statuses');
const { actions: noteActions } = await import('./notes');
const { refusing } = await import('./shared');

const all: AnyAction[] = [...taskActions, ...requestActions, ...reminderActions, ...documentActions, ...statusActions, ...noteActions];
const byName = (name: string) => all.find((a) => a.name === name)!;
const person = (role: AppRole): AuthContext => ({ userId: 'u1', email: 'u@x.test', name: 'U', role });
const actx = (role: AppRole = 'manager', engagementId: string | null = CLIENT): ActionContext => ({ auth: person(role), engagementId, conversationId: null, runId: 'r', now: new Date('2026-11-06T10:00:00Z'), via: 'ask' });

/** Tier and roles, from the route guards each action shares with its screen. */
const STAFF = ['super_admin', 'admin', 'manager', 'intern'];
const MANAGING = ['super_admin', 'admin', 'manager'];
const TABLE: Array<[string, string, string[]]> = [
  ['tasks.list', 'T0', STAFF],
  ['tasks.get', 'T0', STAFF],
  ['tasks.create', 'T2', MANAGING],
  ['tasks.changeStage', 'T2', STAFF],
  ['tasks.edit', 'T2', MANAGING],
  ['tasks.addSubtask', 'T2', STAFF],
  ['tasks.comment', 'T2', STAFF],
  ['tasks.commentToClient', 'T3', STAFF],
  ['tasks.review', 'T3', STAFF],
  ['tasks.addPersonalTodo', 'T1', STAFF],
  ['requests.list', 'T0', STAFF],
  ['requests.create', 'T3', STAFF],
  ['requests.setDetails', 'T2', STAFF],
  ['reminders.draft', 'T1', STAFF],
  ['reminders.sendClient', 'T3', STAFF],
  ['documents.list', 'T0', STAFF],
  ['documents.read', 'T0', STAFF],
  ['documents.review', 'T3', STAFF],
  ['documents.delete', 'T3', STAFF],
  ['statuses.projectOverview', 'T0', STAFF],
  ['statuses.listFilings', 'T0', STAFF],
  ['statuses.markFiled', 'T2', STAFF],
  ['notes.list', 'T0', STAFF],
  ['notes.add', 'T2', STAFF],
  ['notes.delete', 'T3', STAFF],
];

/** A valid input per action, so each one can be run. */
const INPUTS: Record<string, unknown> = {
  'tasks.list': {},
  'tasks.get': { taskId: ID },
  'tasks.create': { name: 'New', dueDate: '2026-12-01' },
  'tasks.changeStage': { taskId: ID, stage: 'review' },
  'tasks.edit': { taskId: ID, dueDate: '2026-12-02' },
  'tasks.addSubtask': { taskId: ID, label: 'Line' },
  'tasks.comment': { taskId: ID, body: 'Hello' },
  'tasks.commentToClient': { taskId: ID, body: 'Hello' },
  'tasks.review': { taskId: ID, decision: 'approve' },
  'tasks.addPersonalTodo': { taskId: ID, label: 'Mine' },
  'requests.list': {},
  'requests.create': { label: 'Rent' },
  'requests.setDetails': { requestId: ID, dueOn: '2026-12-01' },
  'reminders.draft': { itemKey: `request:${ID}` },
  'reminders.sendClient': { itemKey: `request:${ID}` },
  'documents.list': {},
  'documents.read': { documentId: ID },
  'documents.review': { documentId: ID, status: 'approved', reviewAtCard: 'pending ' },
  'documents.delete': { documentId: ID },
  'statuses.projectOverview': {},
  'statuses.listFilings': {},
  'statuses.markFiled': { filingId: ID },
  'notes.list': {},
  'notes.add': { body: 'A note' },
  'notes.delete': { noteId: ID },
};
const needsApproval = (a: AnyAction) => a.tier === 'T2' || a.tier === 'T3';
const repositoryWrites = [tasksRepo.createTask, tasksRepo.changeTaskStage, tasksRepo.editTask, tasksRepo.reviewTask, tasksRepo.addChecklistItem, tasksRepo.addTaskComment, workRepo.addChecklistItem, requestsRepo.createAndNotifyDocumentRequest, clientDocs.setDocumentRequestDetails, docsRepo.setDocumentReview, docsRepo.deleteVaultDocument, send.sendClientReminder, filingStatusRepo.markFilingFiled, notesRepo.createEngagementNote, notesRepo.deleteEngagementNote];

beforeEach(() => {
  vi.clearAllMocks();
  tasksRepo.getTask.mockResolvedValue(task);
  docsRepo.getDocumentById.mockResolvedValue(document);
});

describe('the 25 actions', () => {
  it('holds exactly the actions in the table, with that tier and those roles', () => {
    expect(all.map((a) => a.name).sort()).toEqual(TABLE.map(([name]) => name).sort());
    for (const [name, tier, roles] of TABLE) {
      expect(byName(name).tier, name).toBe(tier);
      expect([...byName(name).roles].sort(), name).toEqual([...roles].sort());
    }
  });

  it('never offers an action to a client, a developer or a partner', () => {
    for (const action of all) for (const role of ['client', 'developer', 'partner']) expect(action.roles).not.toContain(role);
  });

  it.each(TABLE.map(([name]) => name))('%s accepts its input and takes no client in it', (name) => {
    const parsed = byName(name).input.safeParse({ ...(INPUTS[name] as object), engagementId: OTHER });
    expect(parsed.success).toBe(true);
    expect(JSON.stringify(parsed.data)).not.toContain(OTHER);
  });

  it.each(TABLE.filter(([name]) => needsApproval(byName(name))).map(([name]) => name))('%s only prepares a card on preview, and writes nothing', async (name) => {
    const action = byName(name);
    const draft = await action.preview(actx(), action.input.parse(INPUTS[name]));
    expect(draft!.engagementId).toBe(CLIENT);
    expect(draft!.tier).toBe(action.tier);
    expect(draft!.rows).toHaveLength(1);
    expect(draft!.rows[0]!.action).toBe(name);
    if (action.tier === 'T3') expect(Array.isArray(draft!.recipients)).toBe(true);
    for (const write of repositoryWrites) expect(write).not.toHaveBeenCalled();
    // The card applies through the same input it was hashed on.
    const reparsed = action.input.safeParse({ ...draft!.rows[0]!.target, value: draft!.rows[0]!.newValue });
    expect(reparsed.success, name).toBe(true);
  });

  it.each(TABLE.map(([name]) => name))('%s runs as the person, on the locked client', async (name) => {
    const action = byName(name);
    const outcome = await action.execute(actx(), action.input.parse(INPUTS[name]));
    expect(outcome.ok, `${name}: ${JSON.stringify(outcome)}`).toBe(true);
    const calls = [...Object.values(tasksRepo), ...repositoryWrites, ...Object.values(notesRepo).filter((v) => typeof v === 'function'), docsRepo.listDocuments, docsRepo.listVaultRequests, docsRepo.getDocumentById, filingsRepo.getFilings, engagementsRepo.getEngagementById, reminders.resolveReminderTarget]
      .flatMap((fn) => (fn as { mock?: { calls: unknown[][] } }).mock?.calls ?? []);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect((call[0] as AuthContext).userId).toBe('u1');
  });

  it('needs a locked client for everything', async () => {
    for (const [name] of TABLE) {
      const action = byName(name);
      const outcome = needsApproval(action)
        ? await refusing(async () => {
            await action.preview(actx('manager', null), action.input.parse(INPUTS[name]));
            return { ok: true, summary: '' };
          })
        : await action.execute(actx('manager', null), action.input.parse(INPUTS[name]));
      expect(outcome.ok, name).toBe(false);
    }
  });

  it('holds a review note to the length the screen allows', () => {
    expect(byName('tasks.review').input.safeParse({ ...(INPUTS['tasks.review'] as object), note: 'x'.repeat(500) }).success).toBe(true);
    expect(byName('tasks.review').input.safeParse({ ...(INPUTS['tasks.review'] as object), note: 'x'.repeat(501) }).success).toBe(false);
  });

  it('refuses a task or document on another client, as if it were not there', async () => {
    tasksRepo.getTask.mockResolvedValue({ ...task, engagementId: OTHER });
    docsRepo.getDocumentById.mockResolvedValue({ ...document, engagementId: OTHER });
    for (const name of ['tasks.get', 'tasks.changeStage', 'tasks.comment', 'tasks.review', 'tasks.addPersonalTodo', 'documents.read', 'documents.review', 'documents.delete']) {
      const action = byName(name);
      const outcome = await action.execute(actx(), action.input.parse(INPUTS[name]));
      expect(outcome, name).toEqual({ ok: false, error: expect.stringMatching(/not on this project/) });
    }
    for (const write of repositoryWrites) expect(write).not.toHaveBeenCalled();
  });

  it('refuses a filing, request or note that is not on this client', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    for (const [name, input] of [['statuses.markFiled', { filingId: missing }], ['requests.setDetails', { requestId: missing, dueOn: '2026-12-01' }]] as const) {
      const outcome = await byName(name).execute(actx(), input);
      expect(outcome.ok, name).toBe(false);
    }
    await expect(byName('notes.delete').preview(actx(), { noteId: missing })).rejects.toThrow(/not on this project/);
  });

  it('turns a repository refusal into a sentence, and leaves a fault as a fault', async () => {
    tasksRepo.changeTaskStage.mockRejectedValueOnce(new Refusal(403, 'forbidden'));
    expect(await byName('tasks.changeStage').execute(actx('intern'), { taskId: ID, stage: 'completed' })).toEqual({ ok: false, error: 'You cannot do this on this item.' });
    tasksRepo.changeTaskStage.mockRejectedValueOnce(new Error('database down'));
    await expect(byName('tasks.changeStage').execute(actx(), { taskId: ID, stage: 'review' })).rejects.toThrow('database down');
  });

  it('sends a stage only a manager may set to the manager, on the same card', async () => {
    const asLead = await byName('tasks.changeStage').preview(actx('intern'), { taskId: ID, stage: 'completed' });
    expect(asLead!.rows[0]!.target.needsManager).toBe(true);
    const toReview = await byName('tasks.changeStage').preview(actx('intern'), { taskId: ID, stage: 'review' });
    expect(toReview!.rows[0]!.target.needsManager).toBe(false);
    const asManager = await byName('tasks.changeStage').preview(actx('manager'), { taskId: ID, stage: 'completed' });
    expect(asManager!.rows[0]!.target.needsManager).toBe(false);
  });

  it('names the exact recipients from code on an outward card', async () => {
    const draft = await byName('requests.create').preview(actx(), { label: 'Rent' });
    expect(draft!.recipients).toEqual([{ name: 'Client Person', email: 'c@x.test', role: 'Client' }]);
    const review = await byName('tasks.review').preview(actx(), { taskId: ID, decision: 'approve' });
    expect(review!.recipients).toEqual([{ name: 'Owner', role: 'Task owner' }]);
  });

  it('shows everything a new task will hold, and confirms a task the client sees like a message', async () => {
    const firm = await byName('tasks.create').preview(actx(), { name: 'New', dueDate: '2026-12-01', startDate: '2026-11-20', urgency: 'High', checklist: ['Ask the client', 'File it'] });
    expect(firm!.tier).toBe('T2');
    expect(firm!.recipients ?? []).toEqual([]);
    expect(firm!.rows[0]!.displayNew).toBe('New, starts 2026-11-20, due 2026-12-01, High urgency, seen by the firm only. Checklist: Ask the client; File it');
    const shared = await byName('tasks.create').preview(actx(), { name: 'New', dueDate: '2026-12-01', visibility: 'both' });
    expect(shared!.tier).toBe('T3');
    expect(shared!.rows[0]!.displayNew).toContain('seen by the firm and the client');
    expect(shared!.recipients).toEqual([{ name: 'Client Person', email: 'c@x.test', role: 'Client' }]);
  });

  it('confirms a checklist line or review note the client will read like a message, with their names', async () => {
    const client = [{ name: 'Client Person', email: 'c@x.test', role: 'Client' }];
    expect((await byName('tasks.addSubtask').preview(actx(), { taskId: ID, label: 'Line' }))!.tier).toBe('T2');
    tasksRepo.getTask.mockResolvedValueOnce({ ...task, visibility: 'both' });
    const line = await byName('tasks.addSubtask').preview(actx(), { taskId: ID, label: 'Line' });
    expect([line!.tier, line!.recipients]).toEqual(['T3', client]);
    expect((await byName('requests.setDetails').preview(actx(), { requestId: ID, dueOn: '2026-12-01' }))!.tier).toBe('T2');
    const note = await byName('requests.setDetails').preview(actx(), { requestId: ID, reviewNote: 'Scan it again' });
    expect([note!.tier, note!.recipients]).toEqual(['T3', client]);
  });

  it('masks the value a card shows as it stands, as it masks the new one', async () => {
    notesRepo.listEngagementNotes.mockResolvedValueOnce([{ id: ID, authorName: 'A', createdAt: 'x', pinned: false, body: 'Director PAN ABCDE1234F, MCA pwd Acme@2024' }]);
    const row = (await byName('notes.delete').preview(actx(), { noteId: ID }))!.rows[0]!;
    expect([row.displayOld, row.oldValue]).toEqual(['Director PAN XXXXXX234F, MCA pwd [hidden]', 'Director PAN XXXXXX234F, MCA pwd [hidden]']);
  });

  it('lists the people a client comment tells, and refuses when no client would hear of it', async () => {
    const draft = await byName('tasks.commentToClient').preview(actx(), { taskId: ID, body: 'Hello' });
    expect(draft!.recipients).toEqual([{ name: 'Owner', email: 'o@x.test', role: 'Staff' }, { name: 'Client Person', email: 'c@x.test', role: 'Client' }]);
    tasksRepo.taskCommentAudience.mockResolvedValueOnce({ clientSees: false, people: [] });
    await expect(byName('tasks.commentToClient').preview(actx(), { taskId: ID, body: 'Hello' })).rejects.toThrow(/cannot see this task/);
    tasksRepo.taskCommentAudience.mockResolvedValueOnce({ clientSees: false, people: [] });
    expect(await byName('tasks.commentToClient').execute(actx(), { taskId: ID, body: 'Hello' })).toMatchObject({ ok: false });
    expect(tasksRepo.addTaskComment).not.toHaveBeenCalled();
    tasksRepo.taskCommentAudience.mockResolvedValueOnce({ clientSees: true, people: [{ name: 'Owner', email: 'o@x.test', role: 'intern' }] });
    await expect(byName('tasks.commentToClient').preview(actx(), { taskId: ID, body: 'Hello' })).rejects.toThrow(/no client login/);
  });

  it('fixes the filed date on the card, in India\'s day, so the record says what was approved', async () => {
    const late = { ...actx(), now: new Date('2026-11-06T20:00:00Z') };
    const draft = await byName('statuses.markFiled').preview(late, { filingId: ID });
    expect(draft!.rows[0]!.target).toMatchObject({ filedOn: '2026-11-07' });
    expect(draft!.rows[0]!.displayNew).toBe('Filed 2026-11-07');
    expect((await byName('statuses.markFiled').preview(late, { filingId: ID, filedOn: '2026-10-30' }))!.rows[0]!.displayNew).toBe('Filed 2026-10-30');
  });

  it('keeps an internal comment internal, and a client comment visible', async () => {
    await byName('tasks.comment').execute(actx(), { taskId: ID, body: 'x' });
    expect((tasksRepo.addTaskComment.mock.calls[0] as unknown[])[2]).toMatchObject({ internal: true });
    await byName('tasks.commentToClient').execute(actx(), { taskId: ID, body: 'x' });
    expect((tasksRepo.addTaskComment.mock.calls[1] as unknown[])[2]).toMatchObject({ internal: false });
  });

  it('reads a document masked, and refuses an identity document while the flag is off', async () => {
    const outcome = await byName('documents.read').execute(actx(), { documentId: ID });
    expect(outcome.ok).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain('ABCDE1234F');
    storage.getObjectBuffer.mockResolvedValueOnce(Buffer.from('Permanent Account Number Card, Income Tax Department'));
    expect((await byName('documents.read').execute(actx(), { documentId: ID })).ok).toBe(false);
  });

  it('reviews a document only while it stands as it did when the card was made', async () => {
    const draft = await byName('documents.review').preview(actx(), { documentId: ID, status: 'approved' });
    const target = draft!.rows[0]!.target;
    expect(target.reviewAtCard).toEqual(expect.any(String));
    docsRepo.getDocumentById.mockResolvedValueOnce({ ...document, reviewStatus: 'changes', reviewedAt: '2026-11-07T09:00:00.000Z' });
    expect(await byName('documents.review').execute(actx(), target)).toEqual({ ok: false, error: expect.stringContaining('reviewed since this card was made') });
    expect(docsRepo.setDocumentReview).not.toHaveBeenCalled();
    expect((await byName('documents.review').execute(actx(), target)).ok).toBe(true);
  });

  it('asks for a note on "changes needed"', async () => {
    expect((await byName('documents.review').execute(actx(), { documentId: ID, status: 'changes' })).ok).toBe(false);
    expect(docsRepo.setDocumentReview).not.toHaveBeenCalled();
  });

  it('a file in use stays, and a lead cannot remove another person\'s upload', async () => {
    docsRepo.deleteVaultDocument.mockRejectedValueOnce(new Error('in_use'));
    expect(await byName('documents.delete').execute(actx(), { documentId: ID })).toEqual({ ok: false, error: 'This file is in use, so it stays.' });
    docsRepo.deleteVaultDocument.mockRejectedValueOnce(new Error('Delete is not permitted for this role'));
    expect(await byName('documents.delete').execute(actx('intern'), { documentId: ID })).toEqual({ ok: false, error: 'You can remove only your own uploads.' });
  });

  it('offers an undo of a filed mark only to a manager, who alone may reopen a filing', async () => {
    expect(await byName('statuses.markFiled').execute(actx('intern'), { filingId: ID })).not.toHaveProperty('undo');
    expect(await byName('statuses.markFiled').execute(actx('manager'), { filingId: ID })).toMatchObject({ undo: { filingId: ID } });
  });

  it('undoes what has an undo', async () => {
    const todo = byName('tasks.addPersonalTodo');
    const added = await todo.execute(actx(), { taskId: ID, label: 'Mine' });
    expect(added).toMatchObject({ ok: true, undo: { id: 'w1' } });
    expect((await todo.undo!(actx(), { id: 'w1' })).ok).toBe(true);
    expect(workRepo.deleteChecklistItem).toHaveBeenCalledWith(person('manager'), 'w1');
    expect((await byName('documents.delete').undo!(actx(), { documentId: ID })).ok).toBe(true);
    expect((await byName('statuses.markFiled').undo!(actx(), { filingId: ID })).ok).toBe(true);
  });

  it('says when a reminder already went out, without sending', async () => {
    reminders.lastReminderWithinWindow.mockResolvedValueOnce(new Date('2026-11-06T09:00:00Z'));
    const outcome = await byName('reminders.draft').execute(actx(), { itemKey: `request:${ID}` });
    expect(JSON.stringify(outcome)).toContain('alreadySentAt');
    expect(send.sendClientReminder).not.toHaveBeenCalled();
  });
});
