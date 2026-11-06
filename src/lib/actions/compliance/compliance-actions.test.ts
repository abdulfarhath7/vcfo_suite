import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRole, AuthContext } from '@/auth/guards';
import type { ActionContext, AnyAction } from '../types';

/**
 * Every filing action: who may see it, which tier, and that a person's input goes to the screen's own
 * repository, on the locked client only. The repositories keep their own role tests, and
 * `compliance.db.test.ts` runs these actions against them on a real database.
 */
vi.mock('@/db/client', () => ({ db: {} }));

const CLIENT = 'a0000000-0000-4000-8000-00000000000a';
const OTHER = 'b0000000-0000-4000-8000-00000000000b';
const ID = 'd0000000-0000-4000-8000-00000000000d';
const LINE = 'e0000000-0000-4000-8000-00000000000e';

class Refusal extends Error {
  constructor(readonly status: number, code: string) {
    super(code);
  }
}

const found = () => ({
  inst: { id: ID, engagementId: CLIENT, filedOn: null as string | null, periodLabel: 'Oct 2026', windowFrom: '2026-11-01' as string | null, windowTo: '2026-11-10' as string | null, status: 'upcoming' },
  obligation: { id: 'gst-gstr-3b', particular: 'GSTR-3B', complianceArea: 'GST' },
  workflow: null,
  engagement: { id: CLIENT },
});
const detail = () => ({
  id: ID,
  engagementId: CLIENT,
  title: 'GSTR-3B · Oct 2026',
  obligationId: 'gst-gstr-3b',
  area: 'GST',
  stage: 'in-progress',
  stageLabel: 'In progress',
  owner: { id: 'o', name: 'Owner' },
  reviewer: { id: 'r', name: 'Reviewer' },
  can: { submit: true, approve: true },
  clientInputs: null,
  checklist: [],
  filledBySbc: {},
  proofs: [],
  reminders: [],
  remindersBlockedBy: [],
  history: [],
  previous: [],
  rule: {},
});
const statutory = {
  scopedStatutory: vi.fn(async () => found() as ReturnType<typeof found>),
  getStatutoryDetail: vi.fn(async () => detail() as ReturnType<typeof detail>),
  updateStatutory: vi.fn(async () => ({})),
  statutoryStage: vi.fn(() => 'in-progress'),
};
vi.mock('@/db/repositories/compliance-statutory', () => statutory);
const clientCompliances = {
  getPortalFilings: vi.fn(async () => [{ acknowledgementNo: 'old', amountPaid: null, draftDueOn: null }]),
  setFilingReminder: vi.fn(async () => ({ remindOn: '2026-11-15' })),
  clearFilingReminder: vi.fn(async () => undefined),
  upsertFilingDetails: vi.fn(async () => undefined),
};
vi.mock('@/db/repositories/client-compliances', () => clientCompliances);
const reminders = { getReminderSchedule: vi.fn(async () => ({ notifyDays: 5 })), setReminderSchedule: vi.fn(async () => ({})) };
vi.mock('@/db/repositories/compliance-reminder-schedule', () => reminders);
const task = { id: ID, engagementId: CLIENT, title: 'Board minutes', checklistItems: [{ id: LINE, label: 'Ask the client', done: false }] };
const tasks = { getTask: vi.fn(async () => task as typeof task), setChecklistItem: vi.fn(async () => ({})), deleteChecklistItem: vi.fn(async () => undefined) };
vi.mock('@/db/repositories/compliance-tasks', () => tasks);
const filingStatus = { markFilingFiled: vi.fn(async () => ({})), reopenFiling: vi.fn(async () => ({})) };
vi.mock('@/db/repositories/filing-status', () => filingStatus);
const request = { id: ID, engagementId: CLIENT, itemTitle: 'GSTR-3B', fromDate: '2026-11-05', toDate: '2026-11-12', reason: 'Late data', requestedByName: 'Lead', status: 'pending', currentWindow: { from: '2026-11-01', to: '2026-11-10' } };
const windowRequests = {
  listWindowRequests: vi.fn(async () => [request]),
  createWindowRequest: vi.fn(async () => ({ id: ID, engagementId: CLIENT, toDate: '2026-11-12' }) as unknown),
  decideWindowRequest: vi.fn(async () => ({ id: ID, engagementId: CLIENT, requestedBy: 'l', status: 'approved', decisionNote: null }) as unknown),
  withdrawWindowRequest: vi.fn(async () => ({ id: ID }) as unknown),
};
vi.mock('@/db/repositories/item-window-requests', () => windowRequests);
const schedule = { setComplianceInstanceWindow: vi.fn(async () => ({})) };
vi.mock('@/db/repositories/schedule', () => schedule);
const notify = { notifyWindowRequested: vi.fn(async () => undefined), notifyWindowDecided: vi.fn(async () => undefined) };
vi.mock('@/lib/work/window-request-notify', () => notify);
vi.mock('@/db/repositories/engagement-recipients', () => ({
  resolveEngagementRecipients: async () => ({ clients: [{ userId: 'c', name: 'Client Person', email: 'c@x.test' }], managers: [{ userId: 'm', name: 'Manager Person' }] }),
}));
const doc = { id: ID, label: 'Sales register', status: 'To review', note: null, dueOn: null, files: [] };
const inputsDto = () => ({
  docs: [doc],
  needs: [],
  client: [{ key: 'sales', label: 'Sales', value: '100' }],
  sbc: [{ key: 'tax', label: 'Tax payable', value: null as string | null }, { key: 'gstin', label: 'GSTIN', value: null }],
  submittedAt: '2026-11-01' as string | null,
  confirmedAt: null,
  confirmedBy: null,
});
const inputs = {
  getSubjectInputs: vi.fn(async () => inputsDto() as ReturnType<typeof inputsDto> | null),
  saveSubjectFields: vi.fn(async () => true),
  confirmSubjectFields: vi.fn(async () => true),
  askSubjectDocument: vi.fn(async () => 'req-1' as string | null),
  reviewSubjectDocument: vi.fn(async () => true),
};
vi.mock('@/db/repositories/compliance-inputs', () => inputs);
const ticks = { listChecklistTicks: vi.fn(async () => [{ itemKey: 'books', checkedBy: 'A', checkedAt: 'x' }]), setChecklistTick: vi.fn(async () => true) };
vi.mock('@/db/repositories/compliance-checklist-checks', () => ticks);

const { actions } = await import('.');

const byName = (name: string) => actions.find((a) => a.name === name) as AnyAction;
const person = (role: AppRole): AuthContext => ({ userId: 'u1', email: 'u@x.test', name: 'U', role });
const actx = (role: AppRole = 'manager', engagementId: string | null = CLIENT): ActionContext => ({ auth: person(role), engagementId, conversationId: null, runId: 'r', now: new Date('2026-11-06T10:00:00Z'), via: 'ask' });

const STAFF = ['super_admin', 'admin', 'manager', 'intern'];
const MANAGING = ['super_admin', 'admin', 'manager'];
const TABLE: Array<[string, string, string[], Record<string, unknown>]> = [
  ['compliance.getFiling', 'T0', STAFF, { itemId: ID }],
  ['compliance.remindMe', 'T1', STAFF, { itemId: ID }],
  ['compliance.setStage', 'T2', STAFF, { itemId: ID, stage: 'waiting' }],
  ['compliance.submitForReview', 'T3', STAFF, { itemId: ID }],
  ['compliance.review', 'T3', STAFF, { itemId: ID, decision: 'approve' }],
  ['compliance.reopenFiling', 'T2', MANAGING, { itemId: ID }],
  ['compliance.setWorkingWindow', 'T2', MANAGING, { itemId: ID, from: '2026-11-02', to: '2026-11-09' }],
  ['compliance.recordDetails', 'T2', STAFF, { itemId: ID, acknowledgementNo: 'AA1234', draftDueOn: '2026-11-08' }],
  ['compliance.setReminderLead', 'T2', MANAGING, { itemKind: 'filing', itemId: ID, notifyDays: 7 }],
  ['compliance.listDateChanges', 'T0', STAFF, {}],
  ['compliance.requestDateChange', 'T3', ['intern'], { itemId: ID, toDate: '2026-11-12', reason: 'Late data' }],
  ['compliance.decideDateChange', 'T3', MANAGING, { requestId: ID, decision: 'approve' }],
  ['compliance.tickTaskLine', 'T2', STAFF, { taskId: ID, label: 'Ask the client', done: true }],
  ['compliance.removeTaskLine', 'T3', MANAGING, { taskId: ID, label: 'Ask the client' }],
  ['compliance.saveFields', 'T2', STAFF, { itemId: ID, fields: [{ key: 'tax', value: '500' }] }],
  ['compliance.confirmClientDetails', 'T2', STAFF, { itemId: ID }],
  ['compliance.askDocument', 'T3', STAFF, { itemId: ID, label: 'Bank statement' }],
  ['compliance.reviewDocument', 'T3', STAFF, { itemId: ID, requestId: ID, decision: 'accept' }],
  ['compliance.tickChecklist', 'T2', STAFF, { itemId: ID, lines: ['2b'], checked: true }],
];
const inputOf = (name: string) => TABLE.find(([n]) => n === name)![3];
/** Only a filed period can be reopened. */
const filedIf = (name: string) => {
  const row = found();
  if (name === 'compliance.reopenFiling') row.inst.filedOn = '2026-11-01';
  return row;
};
const proposes = (a: AnyAction) => a.tier === 'T2' || a.tier === 'T3';
const writes = [
  statutory.updateStatutory,
  clientCompliances.setFilingReminder,
  clientCompliances.upsertFilingDetails,
  reminders.setReminderSchedule,
  tasks.setChecklistItem,
  tasks.deleteChecklistItem,
  filingStatus.reopenFiling,
  windowRequests.createWindowRequest,
  windowRequests.decideWindowRequest,
  schedule.setComplianceInstanceWindow,
  inputs.saveSubjectFields,
  inputs.confirmSubjectFields,
  inputs.askSubjectDocument,
  inputs.reviewSubjectDocument,
  ticks.setChecklistTick,
];

beforeEach(() => {
  vi.clearAllMocks();
  statutory.scopedStatutory.mockImplementation(async () => found());
  statutory.getStatutoryDetail.mockImplementation(async () => detail());
  tasks.getTask.mockResolvedValue(task);
  inputs.getSubjectInputs.mockImplementation(async () => inputsDto());
});

describe('the filing actions', () => {
  it('holds exactly the actions in the table, with that tier and those roles', () => {
    expect(actions.map((a) => a.name).sort()).toEqual(TABLE.map(([name]) => name).sort());
    for (const [name, tier, roles] of TABLE) {
      expect(byName(name).tier, name).toBe(tier);
      expect([...byName(name).roles].sort(), name).toEqual([...roles].sort());
    }
  });

  it('never offers an action to a client, a developer or a partner, and holds no T4', () => {
    for (const action of actions) {
      expect(action.tier).not.toBe('T4');
      for (const role of ['client', 'developer', 'partner']) expect(action.roles).not.toContain(role);
    }
  });

  it('leaves a project lead out of what only a manager may do, and a manager out of the lead\'s request', () => {
    for (const [name, , roles] of TABLE.filter(([, , r]) => r === MANAGING)) expect(roles, name).not.toContain('intern');
    expect(byName('compliance.requestDateChange').roles).not.toContain('manager');
  });

  it.each(TABLE.map(([name]) => name))('%s accepts its input and takes no client in it', (name) => {
    const parsed = byName(name).input.safeParse({ ...inputOf(name), engagementId: OTHER });
    expect(parsed.success).toBe(true);
    expect(JSON.stringify(parsed.data)).not.toContain(OTHER);
  });

  it.each(TABLE.filter(([, tier]) => tier === 'T2' || tier === 'T3').map(([name]) => name))('%s only prepares a card on preview, and writes nothing', async (name) => {
    const action = byName(name);
    statutory.scopedStatutory.mockImplementation(async () => filedIf(name));
    const draft = await action.preview(actx(), action.input.parse(inputOf(name)));
    expect(draft!.engagementId).toBe(CLIENT);
    expect(draft!.tier).toBe(action.tier);
    expect(draft!.rows).toHaveLength(1);
    expect(draft!.rows[0]!.action).toBe(name);
    if (action.tier === 'T3') expect(Array.isArray(draft!.recipients)).toBe(true);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    // The card applies through the same input it was hashed on.
    expect(action.input.safeParse({ ...draft!.rows[0]!.target, value: draft!.rows[0]!.newValue }).success, name).toBe(true);
  });

  it.each(TABLE.map(([name]) => name))('%s runs as the person, on the locked client', async (name) => {
    const action = byName(name);
    statutory.scopedStatutory.mockImplementation(async () => filedIf(name));
    const outcome = await action.execute(actx(name === 'compliance.requestDateChange' ? 'intern' : 'manager'), action.input.parse(inputOf(name)));
    expect(outcome.ok, `${name}: ${JSON.stringify(outcome)}`).toBe(true);
    const calls = [...writes, statutory.scopedStatutory, statutory.getStatutoryDetail, windowRequests.listWindowRequests, tasks.getTask].flatMap((fn) => fn.mock.calls as unknown[][]);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect((call[0] as AuthContext).userId).toBe('u1');
  });

  it('needs a locked client for everything', async () => {
    for (const [name] of TABLE) {
      const action = byName(name);
      const input = action.input.parse(inputOf(name));
      const refused = proposes(action) ? await action.preview(actx('manager', null), input).then(() => false, () => true) : !(await action.execute(actx('manager', null), input)).ok;
      expect(refused, name).toBe(true);
    }
  });

  it('refuses a filing or task on another client, as if it were not there, and writes nothing', async () => {
    statutory.scopedStatutory.mockImplementation(async () => ({ ...found(), inst: { ...found().inst, engagementId: OTHER } }));
    statutory.getStatutoryDetail.mockImplementation(async () => ({ ...detail(), engagementId: OTHER }));
    tasks.getTask.mockResolvedValue({ ...task, engagementId: OTHER });
    for (const [name] of TABLE) {
      if (name === 'compliance.listDateChanges' || name === 'compliance.decideDateChange') continue;
      const action = byName(name);
      const outcome = await action.execute(actx(), action.input.parse(inputOf(name)));
      expect(outcome, name).toEqual({ ok: false, error: expect.stringMatching(/not on this project/) });
      await expect(action.tier === 'T0' || action.tier === 'T1' ? Promise.reject(new Error('not on this project')) : action.preview(actx(), action.input.parse(inputOf(name))), name).rejects.toThrow(/not on this project/);
    }
    for (const write of writes) expect(write).not.toHaveBeenCalled();
  });

  it('never shows or decides another client\'s date change', async () => {
    windowRequests.listWindowRequests.mockResolvedValueOnce([{ ...request, engagementId: OTHER }]);
    expect(JSON.parse(((await byName('compliance.listDateChanges').execute(actx(), {})) as { summary: string }).summary).total).toBe(0);
    windowRequests.listWindowRequests.mockResolvedValueOnce([{ ...request, engagementId: OTHER }]);
    expect((await byName('compliance.decideDateChange').execute(actx(), { requestId: ID, decision: 'approve' })).ok).toBe(false);
    expect(windowRequests.decideWindowRequest).not.toHaveBeenCalled();
  });

  it('turns a repository refusal into a sentence, and leaves a fault as a fault', async () => {
    const stage = byName('compliance.setStage');
    statutory.updateStatutory.mockRejectedValueOnce(new Refusal(403, 'forbidden'));
    expect(await stage.execute(actx('intern'), { itemId: ID, stage: 'not-applicable' })).toEqual({ ok: false, error: 'You cannot do this on this item.' });
    statutory.updateStatutory.mockRejectedValueOnce(new Refusal(409, 'filed'));
    expect(await stage.execute(actx(), { itemId: ID, stage: 'waiting' })).toEqual({ ok: false, error: 'This filing is already filed.' });
    schedule.setComplianceInstanceWindow.mockRejectedValueOnce(new Error('Only a project manager or admin may set date windows'));
    expect(await byName('compliance.setWorkingWindow').execute(actx('intern'), inputOf('compliance.setWorkingWindow'))).toEqual({ ok: false, error: 'Only a manager or admin can set a working window.' });
    windowRequests.createWindowRequest.mockRejectedValueOnce(new Error('request_pending'));
    expect(await byName('compliance.requestDateChange').execute(actx('intern'), inputOf('compliance.requestDateChange'))).toEqual({ ok: false, error: expect.stringContaining('already have a date change') });
    statutory.updateStatutory.mockRejectedValueOnce(new Error('database down'));
    await expect(stage.execute(actx(), { itemId: ID, stage: 'waiting' })).rejects.toThrow('database down');
  });

  it('never moves a due date, and never takes a person or a recipient from the model', () => {
    for (const action of actions) {
      const shape = Object.keys((action.input as unknown as { shape?: object }).shape ?? {});
      for (const word of ['dueDate', 'ownerId', 'reviewerId', 'recipients', 'engagementId', 'needsManager', 'filedBy']) expect(shape, action.name).not.toContain(word);
    }
  });

  it('keeps review and completion out of a plain stage change', () => {
    const stage = byName('compliance.setStage').input;
    expect(stage.safeParse({ itemId: ID, stage: 'completed' }).success).toBe(false);
    expect(stage.safeParse({ itemId: ID, stage: 'review' }).success).toBe(false);
  });

  it('sends a stage only a manager may set to the manager, on the same card', async () => {
    const asLead = await byName('compliance.setStage').preview(actx('intern'), { itemId: ID, stage: 'not-applicable' });
    expect(asLead!.rows[0]!.target.needsManager).toBe(true);
    const waiting = await byName('compliance.setStage').preview(actx('intern'), { itemId: ID, stage: 'waiting' });
    expect(waiting!.rows[0]!.target.needsManager).toBe(false);
    const asManager = await byName('compliance.setStage').preview(actx('manager'), { itemId: ID, stage: 'not-applicable' });
    expect(asManager!.rows[0]!.target.needsManager).toBe(false);
  });

  it('names the exact recipients from code on an outward card', async () => {
    expect((await byName('compliance.submitForReview').preview(actx(), { itemId: ID }))!.recipients).toEqual([{ name: 'Reviewer', role: 'Reviewer' }]);
    expect((await byName('compliance.review').preview(actx(), { itemId: ID, decision: 'approve' }))!.recipients).toEqual([{ name: 'Owner', role: 'Owner' }]);
    expect((await byName('compliance.askDocument').preview(actx(), inputOf('compliance.askDocument')))!.recipients).toEqual([{ name: 'Client Person', email: 'c@x.test', role: 'Client' }]);
    expect((await byName('compliance.requestDateChange').preview(actx('intern'), inputOf('compliance.requestDateChange')))!.recipients).toEqual([{ name: 'Manager Person', role: 'Manager' }]);
    expect((await byName('compliance.decideDateChange').preview(actx(), { requestId: ID, decision: 'approve' }))!.recipients).toEqual([{ name: 'Lead', role: 'Project lead' }]);
  });

  it('refuses a review the person cannot do, before any card, and asks for a note on a send-back', async () => {
    statutory.getStatutoryDetail.mockImplementation(async () => ({ ...detail(), stage: 'review', can: { submit: false, approve: false } }));
    await expect(byName('compliance.review').preview(actx('intern'), { itemId: ID, decision: 'approve' })).rejects.toThrow('You cannot review');
    statutory.getStatutoryDetail.mockImplementation(async () => detail());
    await expect(byName('compliance.review').preview(actx(), { itemId: ID, decision: 'send-back' })).rejects.toThrow('note');
    await expect(byName('compliance.decideDateChange').preview(actx(), { requestId: ID, decision: 'reject' })).rejects.toThrow('note');
    await expect(byName('compliance.reviewDocument').preview(actx(), { itemId: ID, requestId: ID, decision: 'send-back' })).rejects.toThrow('reason');
  });

  it('refuses a resubmit at the click, and a filed period\'s window and details', async () => {
    statutory.statutoryStage.mockReturnValueOnce('review');
    expect((await byName('compliance.submitForReview').execute(actx(), { itemId: ID })).ok).toBe(false);
    expect(statutory.updateStatutory).not.toHaveBeenCalled();
    statutory.scopedStatutory.mockImplementation(async () => {
      const row = found();
      row.inst.filedOn = '2026-11-01';
      return row;
    });
    expect((await byName('compliance.setWorkingWindow').execute(actx(), inputOf('compliance.setWorkingWindow'))).ok).toBe(false);
    await expect(byName('compliance.saveFields').preview(actx(), inputOf('compliance.saveFields'))).rejects.toThrow('locked after filing');
  });

  it('refuses a field or a checklist line the record does not have', async () => {
    await expect(byName('compliance.saveFields').preview(actx(), { itemId: ID, fields: [{ key: 'password', value: 'x' }] })).rejects.toThrow('not a field');
    expect((await byName('compliance.saveFields').execute(actx(), { itemId: ID, fields: [{ key: 'password', value: 'x' }] })).ok).toBe(false);
    await expect(byName('compliance.tickChecklist').preview(actx(), { itemId: ID, lines: ['invented'], checked: true })).rejects.toThrow('not a line');
    expect(inputs.saveSubjectFields).not.toHaveBeenCalled();
    expect(ticks.setChecklistTick).not.toHaveBeenCalled();
  });

  it('never saves a masked number over a real one, and masks what it shows', async () => {
    expect((await byName('compliance.saveFields').execute(actx(), { itemId: ID, fields: [{ key: 'gstin', value: 'XXXXXX234F' }] })).ok).toBe(false);
    expect(inputs.saveSubjectFields).not.toHaveBeenCalled();
    const draft = await byName('compliance.saveFields').preview(actx(), { itemId: ID, fields: [{ key: 'tax', value: 'PAN ABCDE1234F' }] });
    expect(draft!.rows[0]!.displayNew).not.toContain('ABCDE1234F');
    statutory.getStatutoryDetail.mockImplementation(async () => ({ ...detail(), reviewNote: 'PAN ABCDE1234F is wrong' }) as ReturnType<typeof detail>);
    expect(JSON.stringify(await byName('compliance.getFiling').execute(actx(), { itemId: ID }))).not.toContain('ABCDE1234F');
  });

  it('does not confirm details the client has not submitted, or review a document not waiting', async () => {
    inputs.getSubjectInputs.mockImplementation(async () => ({ ...inputsDto(), submittedAt: null }));
    await expect(byName('compliance.confirmClientDetails').preview(actx(), { itemId: ID })).rejects.toThrow('not submitted');
    inputs.getSubjectInputs.mockImplementation(async () => ({ ...inputsDto(), docs: [{ ...doc, status: 'Asked' }] }));
    expect((await byName('compliance.reviewDocument').execute(actx(), inputOf('compliance.reviewDocument'))).ok).toBe(false);
    expect((await byName('compliance.reviewDocument').execute(actx(), { itemId: ID, requestId: OTHER, decision: 'accept' })).ok).toBe(false);
    expect(inputs.reviewSubjectDocument).not.toHaveBeenCalled();
  });

  it('finds a task line by its words, and refuses a line that is not there or reads the same twice', async () => {
    await byName('compliance.tickTaskLine').execute(actx(), { taskId: ID, label: 'ask the client', done: true });
    expect(tasks.setChecklistItem).toHaveBeenCalledWith(person('manager'), ID, LINE, true);
    expect((await byName('compliance.tickTaskLine').execute(actx(), { taskId: ID, label: 'Nope', done: true })).ok).toBe(false);
    tasks.getTask.mockResolvedValue({ ...task, checklistItems: [...task.checklistItems, { id: ID, label: 'Ask the client', done: false }] });
    expect((await byName('compliance.removeTaskLine').execute(actx(), { taskId: ID, label: 'Ask the client' })).ok).toBe(false);
    expect(tasks.deleteChecklistItem).not.toHaveBeenCalled();
  });

  it('needs a working window to ask to move, and both ends of one to set it', async () => {
    statutory.scopedStatutory.mockImplementation(async () => {
      const row = found();
      row.inst.windowFrom = null;
      row.inst.windowTo = null;
      return row;
    });
    await expect(byName('compliance.requestDateChange').preview(actx('intern'), inputOf('compliance.requestDateChange'))).rejects.toThrow('no working window');
    const window = byName('compliance.setWorkingWindow').input;
    expect(window.safeParse({ itemId: ID, from: '2026-11-02' }).success).toBe(false);
    expect(window.safeParse({ itemId: ID }).success).toBe(true);
  });

  it('tells the managers about a request and the lead about a decision', async () => {
    await byName('compliance.requestDateChange').execute(actx('intern'), inputOf('compliance.requestDateChange'));
    expect(notify.notifyWindowRequested).toHaveBeenCalledTimes(1);
    await byName('compliance.decideDateChange').execute(actx(), { requestId: ID, decision: 'approve' });
    expect(notify.notifyWindowDecided).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 'l', approved: true }));
  });

  it('undoes what has an undo, putting the earlier value back', async () => {
    const run = async (name: string, role: AppRole = 'manager') => {
      const action = byName(name);
      const outcome = await action.execute(actx(role), action.input.parse(inputOf(name)));
      expect(outcome.ok, name).toBe(true);
      const undone = await action.undo!(actx(role), (outcome as { undo: never }).undo);
      expect(undone.ok, name).toBe(true);
    };
    await run('compliance.remindMe');
    expect(clientCompliances.clearFilingReminder).toHaveBeenCalledWith(person('manager'), ID);
    await run('compliance.setStage');
    expect(statutory.updateStatutory).toHaveBeenLastCalledWith(person('manager'), ID, { action: 'stage', stage: 'in-progress' });
    await run('compliance.setWorkingWindow');
    expect(schedule.setComplianceInstanceWindow).toHaveBeenLastCalledWith(person('manager'), ID, { from: '2026-11-01', to: '2026-11-10' });
    await run('compliance.recordDetails');
    expect(clientCompliances.upsertFilingDetails).toHaveBeenLastCalledWith(person('manager'), ID, { acknowledgementNo: 'old', draftDueOn: null });
    await run('compliance.setReminderLead');
    expect(reminders.setReminderSchedule).toHaveBeenLastCalledWith(person('manager'), { kind: 'statutory', id: ID, notifyDays: 5 });
    await run('compliance.requestDateChange', 'intern');
    expect(windowRequests.withdrawWindowRequest).toHaveBeenCalledWith(person('intern'), ID);
    await run('compliance.tickTaskLine');
    expect(tasks.setChecklistItem).toHaveBeenLastCalledWith(person('manager'), ID, LINE, false);
    await run('compliance.saveFields');
    expect(inputs.saveSubjectFields).toHaveBeenLastCalledWith(person('manager'), expect.objectContaining({ side: 'sbc', values: { tax: null } }));
    await run('compliance.tickChecklist');
    expect(ticks.setChecklistTick).toHaveBeenLastCalledWith(person('manager'), expect.objectContaining({ itemKey: '2b', checked: false }));
    statutory.scopedStatutory.mockImplementation(async () => {
      const row = found();
      row.inst.filedOn = '2026-11-01';
      return row;
    });
    await run('compliance.reopenFiling');
    expect(filingStatus.markFilingFiled).toHaveBeenCalledWith(person('manager'), ID, { filedOn: '2026-11-01' });
    expect(await byName('compliance.remindMe').undo!(actx(), { nothing: true } as never)).toEqual({ ok: false, error: 'This cannot be undone.' });
  });

  it('leaves a tick that is already set alone, with nothing to undo', async () => {
    const outcome = await byName('compliance.tickChecklist').execute(actx(), { itemId: ID, lines: ['books'], checked: true });
    expect(outcome).toMatchObject({ ok: true });
    expect((outcome as { undo?: unknown }).undo).toBeUndefined();
    expect(ticks.setChecklistTick).not.toHaveBeenCalled();
  });
});
