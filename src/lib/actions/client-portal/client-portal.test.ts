import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRole, AuthContext } from '@/auth/guards';
import type { ActionContext, ActionResult, AnyAction } from '../types';

/**
 * A client's actions: who may see them, which tier, and that each one reaches only that client's own
 * company, through the screen's own function. The repositories keep their own tenant tests; these
 * check that the actions call them as the signed-in client and refuse what is not on the run.
 */
vi.mock('@/db/client', () => ({ db: {} }));

const OWN = 'a0000000-0000-4000-8000-00000000000a';
const OTHER = 'b0000000-0000-4000-8000-00000000000b';
const REQUEST = 'c0000000-0000-4000-8000-00000000000c';
const FILE_REQUEST = 'c1000000-0000-4000-8000-00000000000c';
const FILING = 'd0000000-0000-4000-8000-00000000000d';
const FILE = 'e0000000-0000-4000-8000-00000000000e';

const attachment = { id: FILE, fileName: 'rent.pdf', contentType: 'application/pdf', sizeBytes: 4, s3Key: 'ask/attachments/u1/x/rent.pdf', kind: 'file' };
const filing = { id: FILING, engagementId: OWN, name: 'GSTR-3B', period: 'Oct 2026', dueDate: '2026-11-20', filedOn: null as string | null };
const fileRequest = { id: FILE_REQUEST, label: 'Passport copy', stepId: 'pre-15', fieldId: 'passportFile', fulfilledAt: undefined as string | undefined };

class UploadRejected extends Error {}
class RequestRefused extends Error {}
const attachments = { getOwnAskAttachments: vi.fn(async (_ctx: unknown, _ids: readonly string[]) => [attachment]) };
vi.mock('@/db/repositories/ask-attachments', () => attachments);
const docs = {
  listOpenDocumentRequests: vi.fn(async (_ctx: unknown, _id: string) => [{ id: REQUEST, title: 'Rent agreement', dueOn: null, note: null }]),
  undoRequestUpload: vi.fn(async () => true as unknown),
  UploadRejectedError: UploadRejected,
};
vi.mock('@/db/repositories/client-documents', () => docs);
const incorporation = {
  listFileRequests: vi.fn(async (_ctx: unknown, _id: string) => [fileRequest]),
  clientAttachRequestedFile: vi.fn(async () => ({})),
  clientUndoRequestedFile: vi.fn(async () => ({})),
  FileRequestError: RequestRefused,
};
vi.mock('@/db/repositories/client-incorporation', () => incorporation);
const compliances = {
  getPortalFilings: vi.fn(async (_ctx: unknown, _input?: unknown) => [filing]),
  addClientFilingProof: vi.fn(async () => ({})),
  setFilingReminder: vi.fn(async () => ({ remindOn: '2026-11-13' })),
  clearFilingReminder: vi.fn(async () => undefined),
  complianceErrorStatus: (error: unknown) => (error instanceof Error && error.message === 'Already filed' ? 400 : null),
};
vi.mock('@/db/repositories/client-compliances', () => compliances);
const inputs = {
  getSubjectInputs: vi.fn(async () => ({ engagementId: OWN as string, client: [{ key: 'pan', label: 'PAN', value: 'ABCDE1234F' }, { key: 'turnover', label: 'Turnover', value: '10' }], submittedAt: null, confirmedAt: null }) as unknown),
  saveSubjectFields: vi.fn(async () => true),
};
vi.mock('@/db/repositories/compliance-inputs', () => inputs);
vi.mock('@/db/repositories/engagement-recipients', () => ({ resolveEngagementRecipients: async () => ({ leads: [{ name: 'Lena Lead', email: 'lena@firm.test' }], managers: [{ name: 'Manu Manager', email: 'manu@firm.test' }] }) }));
const engagementRow = { id: OWN };
const engagements = {
  getEngagementById: vi.fn(async (_ctx: unknown, _id: string) => engagementRow as unknown),
  checklistStateFromRow: vi.fn(() => ({})),
};
vi.mock('@/db/repositories/engagements', () => engagements);
const gate = { kind: 'active' as string, message: null as string | null };
vi.mock('@/lib/checklist/checklist-step-gate', () => ({ gateActiveCatalog: () => ({}), getStepGate: () => gate, checklistGateViewerFrom: () => 'client' }));
const answered = { answerDocumentRequest: vi.fn(async () => ({ out: { fileIds: ['f1'], rejected: [] as Array<{ error: string }>, requestLabel: 'Rent agreement', engagementId: OWN }, email: null }) as unknown) };
vi.mock('@/lib/requests/answer-document-request', () => answered);
const messages = { sendClientMessage: vi.fn(async () => ({ id: 'm1' }) as unknown) };
vi.mock('@/lib/messages/send-client-message', () => messages);
const change = { requestClientStepChange: vi.fn(async () => ({ request: { stepTitle: 'Directors' }, checklistState: {}, email: null }) as unknown) };
vi.mock('@/lib/client/request-step-change', () => change);
const submit = { submitDirectStep: vi.fn(async () => ({ outcome: 'completed', email: null }) as unknown) };
vi.mock('@/lib/incorporation/submit-direct-step', () => submit);
vi.mock('@/lib/incorporation/apply-checklist-patch', () => ({ applyChecklistPatch: vi.fn(), ChecklistPatchRefused: class extends Error {} }));
vi.mock('@/db/repositories/documents', () => ({ indexMilestoneUpload: vi.fn(async () => ({})) }));
const storage = { getObjectBuffer: vi.fn(async () => Buffer.from('%PDF') as Buffer | null), putObject: vi.fn(async () => undefined), bucketKey: (bucket: string, key: string) => `${bucket}/${key}` };
vi.mock('@/storage/s3', () => storage);

const { actions } = await import('./index');
const { actionsForRole } = await import('../registry');
const { bestItem, matchClientFiles } = await import('./file-card');

const TABLE: Array<[string, string]> = [
  ['client-portal.overview', 'T0'],
  ['client-portal.listFilings', 'T0'],
  ['client-portal.readDetails', 'T0'],
  ['client-portal.remindFiling', 'T1'],
  ['client-portal.saveDetails', 'T2'],
  ['client-portal.setAnswer', 'T2'],
  ['client-portal.attachFile', 'T2'],
  ['client-portal.attachRequestedFile', 'T2'],
  ['client-portal.uploadToRequest', 'T3'],
  ['client-portal.addFilingProof', 'T3'],
  ['client-portal.sendMessage', 'T3'],
  ['client-portal.replyToRequest', 'T3'],
  ['client-portal.requestStepChange', 'T3'],
  ['client-portal.submitStep', 'T3'],
];
const INPUTS: Record<string, Record<string, unknown>> = {
  'client-portal.overview': {},
  'client-portal.listFilings': {},
  'client-portal.readDetails': { kind: 'obligation', key: FILING },
  'client-portal.remindFiling': { filingId: FILING },
  'client-portal.saveDetails': { kind: 'obligation', key: FILING, values: { turnover: '20' } },
  'client-portal.setAnswer': { engagementId: OWN, stepId: 'pre-15', fieldId: 'x', value: 'y' },
  'client-portal.attachFile': { engagementId: OWN, stepId: 'pre-15', fieldId: 'x', attachmentId: FILE, value: 'rent.pdf' },
  'client-portal.attachRequestedFile': { requestId: FILE_REQUEST, attachmentId: FILE },
  'client-portal.uploadToRequest': { requestId: REQUEST, attachmentIds: [FILE] },
  'client-portal.addFilingProof': { filingId: FILING, attachmentId: FILE, kind: 'challan' },
  'client-portal.sendMessage': { body: 'When is the next filing?' },
  'client-portal.replyToRequest': { requestId: REQUEST, body: 'It comes on Friday.' },
  'client-portal.requestStepChange': { stepId: 'pre-15', note: 'The address changed.' },
  'client-portal.submitStep': { stepId: 'pre-15' },
};
const OWN_DRAFTS = TABLE.filter(([, tier]) => tier === 'T2' || tier === 'T3').map(([name]) => name).filter((name) => name !== 'client-portal.setAnswer' && name !== 'client-portal.attachFile');
const STAFF: AppRole[] = ['super_admin', 'admin', 'manager', 'intern', 'developer', 'partner' as AppRole];

const auth = (role: AppRole = 'client'): AuthContext => ({ userId: 'u1', email: 'c@x.test', name: 'Cora Client', role });
const actx = (engagementId: string | null = OWN): ActionContext => ({ auth: auth(), engagementId, conversationId: null, runId: null, now: new Date('2026-11-06T10:00:00Z'), via: 'ask' });
const byName = (name: string) => actions.find((a: AnyAction) => a.name === name)!;
const run = (name: string, patch: Record<string, unknown> = {}, on = actx()) => byName(name).execute(on, byName(name).input.parse({ ...INPUTS[name], ...patch }));
const preview = (name: string, patch: Record<string, unknown> = {}, on = actx()) => byName(name).preview(on, byName(name).input.parse({ ...INPUTS[name], ...patch }));

const undoOf = (outcome: ActionResult) => (outcome.ok ? (outcome.undo ?? null) : null);

const WRITES = [compliances.addClientFilingProof, compliances.setFilingReminder, incorporation.clientAttachRequestedFile, inputs.saveSubjectFields, answered.answerDocumentRequest, messages.sendClientMessage, change.requestClientStepChange, submit.submitDirectStep, storage.putObject];

beforeEach(() => {
  vi.clearAllMocks();
  gate.kind = 'active';
  gate.message = null;
  filing.filedOn = null;
  filing.engagementId = OWN;
  fileRequest.fulfilledAt = undefined;
  storage.getObjectBuffer.mockResolvedValue(Buffer.from('%PDF'));
});

describe('a client\'s actions', () => {
  it('holds exactly the actions in the table, for the client role alone', () => {
    expect(actions.map((a: AnyAction) => [a.name, a.tier]).sort()).toEqual([...TABLE].sort());
    for (const action of actions) expect(action.roles).toEqual(['client']);
  });

  it('offers none of them to staff, and no staff action to a client', async () => {
    for (const role of STAFF) expect((await actionsForRole(role)).some((a: AnyAction) => a.name.startsWith('client-portal.'))).toBe(false);
    const own = await actionsForRole('client');
    expect(own.map((a: AnyAction) => a.name).sort()).toEqual(TABLE.map(([name]) => name).sort());
  });

  it('has no T4 action, and nothing that reaches a login, an OTP or a sign-off', () => {
    for (const action of actions) {
      expect(action.tier).not.toBe('T4');
      expect(action.name).not.toMatch(/credential|otp|identifier|approve|role|password/i);
    }
  });

  it('never takes a company in the input of an action the model can call', () => {
    for (const action of actions.filter((a: AnyAction) => !a.routerOnly)) {
      expect(Object.keys((action.input as unknown as { shape: object }).shape)).not.toContain('engagementId');
    }
  });

  it('writes nothing on preview, and the card row parses back to the same input', async () => {
    for (const name of OWN_DRAFTS) {
      const draft = await preview(name);
      expect(draft, name).not.toBeNull();
      expect(draft!.engagementId, name).toBe(OWN);
      for (const row of draft!.rows) {
        expect(row.action).toBe(name);
        const parsed = byName(name).input.safeParse({ ...row.target, value: row.newValue });
        expect(parsed.success, name).toBe(true);
      }
    }
    for (const write of WRITES) expect(write).not.toHaveBeenCalled();
  });

  it('runs every write as the person who asked', async () => {
    for (const name of OWN_DRAFTS) await run(name);
    await run('client-portal.remindFiling');
    for (const write of WRITES.filter((w) => w !== storage.putObject)) {
      const calls = (write as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect((call[0] as AuthContext).userId).toBe('u1');
    }
  });

  it('needs a run locked to their company for everything', async () => {
    for (const [name] of TABLE) {
      if (name === 'client-portal.setAnswer' || name === 'client-portal.attachFile') continue;
      const outcome = await run(name, {}, actx(null));
      expect(outcome.ok, name).toBe(false);
    }
    for (const write of WRITES) expect(write).not.toHaveBeenCalled();
  });
});

describe('across companies', () => {
  it('refuses a request that is not open on their company, as if it were not there', async () => {
    docs.listOpenDocumentRequests.mockResolvedValue([]);
    for (const name of ['client-portal.uploadToRequest', 'client-portal.replyToRequest']) {
      const outcome = await run(name);
      expect(outcome).toMatchObject({ ok: false, error: 'That request is not open on your company.' });
      await expect(preview(name)).rejects.toThrow(/not open on your company/);
    }
    expect(answered.answerDocumentRequest).not.toHaveBeenCalled();
    expect(messages.sendClientMessage).not.toHaveBeenCalled();
    docs.listOpenDocumentRequests.mockResolvedValue([{ id: REQUEST, title: 'Rent agreement', dueOn: null, note: null }]);
  });

  it('looks up requests on the run\'s company only', async () => {
    await run('client-portal.uploadToRequest');
    expect(docs.listOpenDocumentRequests.mock.calls[0]![1]).toBe(OWN);
    await run('client-portal.attachRequestedFile');
    expect(incorporation.listFileRequests.mock.calls[0]![1]).toBe(OWN);
  });

  it('refuses a filing or details on another company', async () => {
    filing.engagementId = OTHER;
    for (const name of ['client-portal.remindFiling', 'client-portal.addFilingProof']) expect((await run(name)).ok, name).toBe(false);
    inputs.getSubjectInputs.mockResolvedValueOnce({ engagementId: OTHER, client: [], submittedAt: null, confirmedAt: null });
    expect(await run('client-portal.readDetails')).toMatchObject({ ok: false });
    expect(compliances.setFilingReminder).not.toHaveBeenCalled();
    expect(compliances.addClientFilingProof).not.toHaveBeenCalled();
  });

  it('refuses an answer aimed at another company, though the row names one', async () => {
    for (const name of ['client-portal.setAnswer', 'client-portal.attachFile']) {
      await expect(preview(name, { engagementId: OTHER })).rejects.toThrow(/not on this project/);
      expect(await run(name, { engagementId: OTHER })).toMatchObject({ ok: false });
    }
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(engagements.getEngagementById).not.toHaveBeenCalled();
  });

  it('sends messages and step changes to the run\'s company, whatever the input adds', async () => {
    await run('client-portal.sendMessage', { engagementId: OTHER });
    expect((messages.sendClientMessage.mock.calls[0] as unknown[])[1]).toEqual({ engagementId: OWN, body: 'When is the next filing?' });
    await run('client-portal.requestStepChange', { engagementId: OTHER });
    expect((change.requestClientStepChange.mock.calls[0] as unknown[])[1]).toMatchObject({ engagementId: OWN });
  });

  it('shows only their own filings, though the repository was given no company', async () => {
    compliances.getPortalFilings.mockResolvedValueOnce([filing, { ...filing, id: 'x', engagementId: OTHER }]);
    const outcome = await run('client-portal.listFilings');
    expect(JSON.parse((outcome as { summary: string }).summary).total).toBe(1);
  });

  it('refuses a chat file that is not this person\'s own', async () => {
    attachments.getOwnAskAttachments.mockResolvedValueOnce([]);
    expect(await run('client-portal.uploadToRequest')).toMatchObject({ ok: false });
    expect(answered.answerDocumentRequest).not.toHaveBeenCalled();
  });
});

describe('what each one does', () => {
  it('names the firm\'s people from code, by name, without their email', async () => {
    const draft = await preview('client-portal.sendMessage');
    expect(draft!.recipients).toEqual([{ name: 'Lena Lead', role: 'Project lead' }]);
    expect(JSON.stringify(draft)).not.toContain('@firm.test');
    const asked = await preview('client-portal.requestStepChange');
    expect(asked!.recipients!.map((p) => p.name)).toEqual(['Lena Lead', 'Manu Manager']);
  });

  it('replies on the request\'s own thread', async () => {
    await run('client-portal.replyToRequest');
    expect((messages.sendClientMessage.mock.calls[0] as unknown[])[1]).toMatchObject({ itemKey: expect.stringContaining(REQUEST) });
  });

  it('masks identity numbers it reads back, in details and in the old value', async () => {
    const outcome = await run('client-portal.readDetails');
    expect(JSON.stringify(outcome)).not.toContain('ABCDE1234F');
    const draft = await preview('client-portal.saveDetails', { values: { turnover: '20', pan: 'ABCDE1234F' } });
    expect(draft!.rows[0]!.displayOld).not.toContain('ABCDE1234F');
  });

  it('refuses a detail the firm fills or nobody asked for', async () => {
    await expect(preview('client-portal.saveDetails', { values: { sbcOnly: '1' } })).rejects.toThrow(/firm fills/);
    await expect(preview('client-portal.saveDetails', { values: { turnover: '1', sbcOnly: '1' } })).rejects.toThrow(/firm fills/);
    inputs.saveSubjectFields.mockResolvedValueOnce(false);
    expect((await run('client-portal.saveDetails')).ok).toBe(false);
  });

  it('saves details on the client side only, and puts the old ones back', async () => {
    const outcome = await run('client-portal.saveDetails');
    expect((inputs.saveSubjectFields.mock.calls[0] as unknown[])[1]).toMatchObject({ side: 'client', values: { turnover: '20' } });
    const back = await byName('client-portal.saveDetails').undo!(actx(), undoOf(outcome));
    expect(back.ok).toBe(true);
    expect((inputs.saveSubjectFields.mock.calls[1] as unknown[])[1]).toMatchObject({ side: 'client', values: { turnover: '10' } });
  });

  it('files the chat file where the firm asked for it, and can take it back', async () => {
    const outcome = await run('client-portal.attachRequestedFile');
    expect(outcome.ok).toBe(true);
    const stored = (incorporation.clientAttachRequestedFile.mock.calls[0] as unknown[]);
    expect(stored[1]).toBe(OWN);
    expect(stored[2]).toBe('pre-15');
    expect(String((stored[3] as { path: string }).path)).toContain(`${OWN}/passportFile/`);
    const back = await byName('client-portal.attachRequestedFile').undo!(actx(), undoOf(outcome));
    expect(back.ok).toBe(true);
    expect(incorporation.clientUndoRequestedFile).toHaveBeenCalledTimes(1);
  });

  it('says so when a requested file was closed since the card was made', async () => {
    fileRequest.fulfilledAt = '2026-11-06';
    expect(await run('client-portal.attachRequestedFile')).toMatchObject({ ok: false, error: 'That request is not open on your company.' });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('refuses a step file of a type the screen would refuse', async () => {
    attachments.getOwnAskAttachments.mockResolvedValueOnce([{ ...attachment, fileName: 'run.exe', contentType: 'application/x-msdownload' }]);
    attachments.getOwnAskAttachments.mockResolvedValueOnce([{ ...attachment, fileName: 'run.exe', contentType: 'application/x-msdownload' }]);
    expect(await run('client-portal.attachRequestedFile')).toMatchObject({ ok: false, error: expect.stringMatching(/file type/) });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('passes the screen\'s upload refusal on as a sentence, and takes back within the window', async () => {
    answered.answerDocumentRequest.mockRejectedValueOnce(new UploadRejected('This request is closed.'));
    expect(await run('client-portal.uploadToRequest')).toMatchObject({ ok: false, error: 'This request is closed.' });
    answered.answerDocumentRequest.mockResolvedValueOnce({ out: { fileIds: [], rejected: [{ error: 'Too large.' }], requestLabel: 'Rent', engagementId: OWN }, email: null });
    expect(await run('client-portal.uploadToRequest')).toMatchObject({ ok: false, error: 'Too large.' });
    const outcome = await run('client-portal.uploadToRequest');
    expect(await byName('client-portal.uploadToRequest').undo!(actx(), undoOf(outcome))).toMatchObject({ ok: true });
    docs.undoRequestUpload.mockResolvedValueOnce(false);
    expect(await byName('client-portal.uploadToRequest').undo!(actx(), undoOf(outcome))).toMatchObject({ ok: false });
  });

  it('turns a refused proof into a sentence and leaves a fault as a fault', async () => {
    compliances.addClientFilingProof.mockRejectedValueOnce(new Error('Already filed'));
    expect(await run('client-portal.addFilingProof')).toMatchObject({ ok: false, error: 'Already filed' });
    compliances.addClientFilingProof.mockRejectedValueOnce(new Error('boom'));
    await expect(run('client-portal.addFilingProof')).rejects.toThrow('boom');
  });

  it('sets and clears their own reminder, and not on a filed filing', async () => {
    const outcome = await run('client-portal.remindFiling');
    expect(outcome.ok).toBe(true);
    expect(await byName('client-portal.remindFiling').undo!(actx(), undoOf(outcome))).toMatchObject({ ok: true });
    expect(compliances.clearFilingReminder).toHaveBeenCalledTimes(1);
    filing.filedOn = '2026-11-01';
    expect(await run('client-portal.remindFiling')).toMatchObject({ ok: false, error: 'This filing is already filed.' });
  });

  it('submits only a step that is theirs and open, through the screen\'s function', async () => {
    expect(await run('client-portal.submitStep')).toMatchObject({ ok: true });
    expect((submit.submitDirectStep.mock.calls[0] as unknown[]).slice(1)).toEqual([OWN, 'pre-15', {}]);
    submit.submitDirectStep.mockClear();
    await expect(preview('client-portal.submitStep', { stepId: 'pre-2' })).rejects.toThrow(/project lead handles/);
    await expect(preview('client-portal.submitStep', { stepId: 'nope' })).rejects.toThrow(/not on your company file/);
    gate.kind = 'done';
    expect(await run('client-portal.submitStep')).toMatchObject({ ok: false, error: expect.stringMatching(/already submitted/) });
    gate.kind = 'locked';
    gate.message = 'Finish the step before first.';
    expect(await run('client-portal.submitStep')).toMatchObject({ ok: false, error: 'Finish the step before first.' });
    expect(submit.submitDirectStep).not.toHaveBeenCalled();
  });

  it('says what stopped a submit, masked, and maps the screen\'s refusals', async () => {
    submit.submitDirectStep.mockResolvedValueOnce({ outcome: 'invalid', fieldErrors: { pan: 'ABCDE1234F is not valid.' } });
    const invalid = await run('client-portal.submitStep');
    expect(invalid).toMatchObject({ ok: false, error: expect.stringMatching(/need work/) });
    expect(JSON.stringify(invalid)).not.toContain('ABCDE1234F');
    submit.submitDirectStep.mockRejectedValueOnce(new Error('step_waiting_on_lead'));
    expect(await run('client-portal.submitStep')).toMatchObject({ ok: false, error: 'Your project lead is finishing this step.' });
    submit.submitDirectStep.mockResolvedValueOnce({ outcome: 'waiting_on_lead', email: null });
    expect(await run('client-portal.submitStep')).toMatchObject({ ok: true, summary: expect.stringMatching(/with your project lead/) });
  });

  it('lists steps with the gate the screen uses', async () => {
    const outcome = await run('client-portal.overview');
    const summary = JSON.parse((outcome as { summary: string }).summary);
    expect(summary.requests[0].id).toBe(REQUEST);
    expect(summary.filesAskedForOnSteps[0].id).toBe(FILE_REQUEST);
    expect(summary.steps.find((s: { stepId: string }) => s.stepId === 'pre-15')).toMatchObject({ state: 'active', youFill: true });
    expect(summary.steps.find((s: { stepId: string }) => s.stepId === 'pre-2')).toMatchObject({ youFill: false });
  });
});

describe('matching a file to what is open, by code', () => {
  const items = [
    { kind: 'request' as const, id: '1', label: 'Rent agreement for the office' },
    { kind: 'request' as const, id: '2', label: 'Electricity bill' },
    { kind: 'fileRequest' as const, id: '3', label: 'Passport copy' },
  ];

  it('takes the one item named, and never a tie or a generic word', () => {
    expect(bestItem('rent-agreement.pdf', items)?.id).toBe('1');
    expect(bestItem('my passport', items)?.id).toBe('3');
    expect(bestItem('the document', items)).toBeNull();
    expect(bestItem('rent and electricity', items)).toBeNull();
    expect(bestItem('holiday photos', items)).toBeNull();
  });

  const file = (fileName: string, id = FILE) => ({ id, fileName });

  it('groups a request\'s files on one row and gives the card the people to tell', async () => {
    const SECOND = 'e1000000-0000-4000-8000-00000000000e';
    attachments.getOwnAskAttachments.mockResolvedValueOnce([attachment, { ...attachment, id: SECOND, fileName: 'rent-2.pdf' }]);
    const { draft, note } = await matchClientFiles(actx(), [file('rent.pdf'), file('rent-2.pdf', SECOND)], 'the rent agreement');
    expect(draft!.tier).toBe('T3');
    expect(draft!.rows).toHaveLength(1);
    expect(draft!.rows[0]!.target).toMatchObject({ requestId: REQUEST, attachmentIds: [FILE, SECOND] });
    expect(draft!.recipients!.map((p) => p.name)).toEqual(['Lena Lead']);
    expect(note).toBe('');
  });

  it('reaches filings only when proof is mentioned, and only unfiled ones on this company', async () => {
    docs.listOpenDocumentRequests.mockResolvedValueOnce([]);
    incorporation.listFileRequests.mockResolvedValueOnce([]);
    expect((await matchClientFiles(actx(), [file('gstr-3b.pdf')], '')).draft).toBeNull();
    expect(compliances.getPortalFilings).not.toHaveBeenCalled();
    docs.listOpenDocumentRequests.mockResolvedValueOnce([]);
    incorporation.listFileRequests.mockResolvedValueOnce([]);
    compliances.getPortalFilings.mockResolvedValueOnce([filing, { ...filing, id: 'other', engagementId: OTHER, name: 'GSTR-9' }]);
    const { draft } = await matchClientFiles(actx(), [file('gstr-3b-challan.pdf')], '');
    expect(draft!.rows[0]!.target).toMatchObject({ filingId: FILING, kind: 'challan' });
    docs.listOpenDocumentRequests.mockResolvedValueOnce([]);
    incorporation.listFileRequests.mockResolvedValueOnce([]);
    compliances.getPortalFilings.mockResolvedValueOnce([{ ...filing, id: 'other', engagementId: OTHER, name: 'GSTR-9' }]);
    expect((await matchClientFiles(actx(), [file('gstr-9-challan.pdf')], '')).draft).toBeNull();
  });

  it('leaves a file it cannot place off the card, and says what is open', async () => {
    const { draft, note } = await matchClientFiles(actx(), [file('rent.pdf'), file('holiday.pdf', 'e2000000-0000-4000-8000-00000000000e')], '');
    expect(draft!.rows).toHaveLength(1);
    expect(note).toMatch(/could not tell what holiday.pdf is for/);
    expect(note).toMatch(/Still open/);
  });
});
