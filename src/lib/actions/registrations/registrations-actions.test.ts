import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRole, AuthContext } from '@/auth/guards';
import type { ActionContext, AnyAction } from '../types';

/**
 * Every registration action: who may see it, which tier, and that it reaches the screen's own
 * repositories on the locked client. `compliance/compliance.db.test.ts` runs them on a real database.
 */
vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/db/repositories/engagement-recipients', () => ({ resolveEngagementRecipients: async () => ({ clients: [{ userId: 'c', name: 'Client Person', email: 'c@x.test' }], managers: [] }) }));

const CLIENT = 'a0000000-0000-4000-8000-00000000000a';
const OTHER = 'b0000000-0000-4000-8000-00000000000b';
const ID = 'd0000000-0000-4000-8000-00000000000d';
const STEP = 'reg-4';

const facts = (): Record<string, unknown> => ({ [STEP]: { number: 'ABCDE1234F', registeredOn: null, certificate: null, issuedOn: '2026-01-01', expiresOn: null, renewEveryMonths: 12 } });
const credentials = {
  listRegistrationFacts: vi.fn(async () => ({ [CLIENT]: facts() }) as Record<string, Record<string, unknown>>),
  setRegistrationDates: vi.fn(async () => ({})),
};
vi.mock('@/db/repositories/credentials', () => credentials);
const engagements = {
  getEngagementById: vi.fn(async () => ({ id: CLIENT, incorporationDate: '2026-01-01', schedule: {} }) as unknown),
  checklistStateFromRow: () => ({ 'reg-4': { status: 'in-progress' }, 'reg-1': { status: 'not-applicable' } }),
};
vi.mock('@/db/repositories/engagements', () => engagements);
const applicability = { getComplianceStarts: vi.fn(async () => ({ byStep: { [STEP]: { applies: true, why: 'Turnover', rule: 'Rule', notNeeded: '', answers: [], startsOn: null, starts: [{ name: 'GSTR-3B', freqLabel: 'Monthly', authorityName: 'GSTN' }] } } })) };
vi.mock('@/db/repositories/registration-applicability', () => applicability);
const inputsDto = () => ({ docs: [], needs: ['PAN'], client: [], sbc: [{ key: 'arn', label: 'ARN', value: null }], submittedAt: '2026-11-01', confirmedAt: null, confirmedBy: null });
const inputs = {
  getSubjectInputs: vi.fn(async () => inputsDto() as ReturnType<typeof inputsDto> | null),
  saveSubjectFields: vi.fn(async () => true),
  confirmSubjectFields: vi.fn(async () => true),
  askSubjectDocument: vi.fn(async () => 'req' as string | null),
  reviewSubjectDocument: vi.fn(async () => true),
};
vi.mock('@/db/repositories/compliance-inputs', () => inputs);
const ticks = { listChecklistTicks: vi.fn(async () => []), setChecklistTick: vi.fn(async () => true) };
vi.mock('@/db/repositories/compliance-checklist-checks', () => ticks);

const { actions } = await import('.');

const byName = (name: string) => actions.find((a) => a.name === name) as AnyAction;
const person = (role: AppRole): AuthContext => ({ userId: 'u1', email: 'u@x.test', name: 'U', role });
const actx = (role: AppRole = 'manager', engagementId: string | null = CLIENT): ActionContext => ({ auth: person(role), engagementId, conversationId: null, runId: 'r', now: new Date('2026-11-06T10:00:00Z'), via: 'ask' });

const STAFF = ['super_admin', 'admin', 'manager', 'intern'];
const TABLE: Array<[string, string, Record<string, unknown>]> = [
  ['registrations.list', 'T0', {}],
  ['registrations.get', 'T0', { itemId: STEP }],
  ['registrations.setDates', 'T2', { itemId: STEP, expiresOn: '2027-01-01' }],
  ['registrations.saveFields', 'T2', { itemId: STEP, fields: [{ key: 'arn', value: 'AA36' }] }],
  ['registrations.confirmClientDetails', 'T2', { itemId: STEP }],
  ['registrations.askDocument', 'T3', { itemId: STEP, label: 'Rent agreement' }],
  ['registrations.reviewDocument', 'T3', { itemId: STEP, requestId: ID, decision: 'accept' }],
  ['registrations.tickChecklist', 'T2', { itemId: STEP, lines: ['documents'], checked: true }],
];
const inputOf = (name: string) => TABLE.find(([n]) => n === name)![2];
const writes = [credentials.setRegistrationDates, inputs.saveSubjectFields, inputs.confirmSubjectFields, inputs.askSubjectDocument, inputs.reviewSubjectDocument, ticks.setChecklistTick];

beforeEach(() => {
  vi.clearAllMocks();
  inputs.getSubjectInputs.mockImplementation(async () => inputsDto());
  credentials.listRegistrationFacts.mockImplementation(async () => ({ [CLIENT]: facts() }));
  engagements.getEngagementById.mockImplementation(async () => ({ id: CLIENT, incorporationDate: '2026-01-01', schedule: {} }));
});

describe('the registration actions', () => {
  it('holds exactly the actions in the table, for staff only', () => {
    expect(actions.map((a) => a.name).sort()).toEqual(TABLE.map(([name]) => name).sort());
    for (const [name, tier] of TABLE) {
      expect(byName(name).tier, name).toBe(tier);
      expect([...byName(name).roles].sort(), name).toEqual([...STAFF].sort());
    }
  });

  it('takes no client, no secret and no registration number from the model', () => {
    for (const action of actions) {
      const shape = Object.keys((action.input as unknown as { shape: object }).shape);
      for (const word of ['engagementId', 'recipients', 'number', 'password', 'otp', 'token']) expect(shape, action.name).not.toContain(word);
    }
  });

  it('refuses a step that is not a registration, by its shape and by its record', async () => {
    expect(byName('registrations.get').input.safeParse({ itemId: 'pre-1' }).success).toBe(false);
    expect((await byName('registrations.get').execute(actx(), { itemId: 'reg-999' })).ok).toBe(false);
    await expect(byName('registrations.setDates').preview(actx(), { itemId: 'reg-999', expiresOn: '2027-01-01' })).rejects.toThrow('not available');
  });

  it.each(TABLE.filter(([, tier]) => tier !== 'T0').map(([name]) => name))('%s only prepares a card on preview, and writes nothing', async (name) => {
    if (name === 'registrations.reviewDocument') inputs.getSubjectInputs.mockImplementation(async () => ({ ...inputsDto(), docs: [{ id: ID, label: 'Rent', status: 'To review', note: null, dueOn: null, files: [] }] }) as never);
    const action = byName(name);
    const draft = await action.preview(actx(), action.input.parse(inputOf(name)));
    expect(draft!.engagementId).toBe(CLIENT);
    expect(draft!.tier).toBe(action.tier);
    expect(draft!.rows[0]!.action).toBe(name);
    if (action.tier === 'T3') expect(draft!.recipients).toEqual([{ name: 'Client Person', email: 'c@x.test', role: 'Client' }]);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(action.input.safeParse({ ...draft!.rows[0]!.target, value: draft!.rows[0]!.newValue }).success, name).toBe(true);
  });

  it.each(TABLE.map(([name]) => name))('%s runs as the person, on the locked client', async (name) => {
    if (name === 'registrations.reviewDocument') inputs.getSubjectInputs.mockImplementation(async () => ({ ...inputsDto(), docs: [{ id: ID, label: 'Rent', status: 'To review', note: null, dueOn: null, files: [] }] }) as never);
    const action = byName(name);
    const outcome = await action.execute(actx(), action.input.parse(inputOf(name)));
    expect(outcome.ok, `${name}: ${JSON.stringify(outcome)}`).toBe(true);
    expect(engagements.getEngagementById).toHaveBeenCalledWith(person('manager'), CLIENT);
    for (const write of writes) for (const call of write.mock.calls as unknown[][]) expect(call[0]).toEqual(person('manager'));
  });

  it('needs a locked client for everything', async () => {
    for (const [name, tier] of TABLE) {
      const action = byName(name);
      const input = action.input.parse(inputOf(name));
      const refused = tier === 'T0' ? !(await action.execute(actx('manager', null), input)).ok : await action.preview(actx('manager', null), input).then(() => false, () => true);
      expect(refused, name).toBe(true);
    }
  });

  it('reads as not available when the person cannot reach the client, and writes nothing', async () => {
    engagements.getEngagementById.mockResolvedValue(null);
    for (const [name] of TABLE) {
      const action = byName(name);
      expect(await action.execute(actx('intern'), action.input.parse(inputOf(name))), name).toEqual({ ok: false, error: expect.stringContaining('not available') });
    }
    for (const write of writes) expect(write).not.toHaveBeenCalled();
  });

  it('shows the screen\'s status, leaves out what is not needed, and masks a number', async () => {
    const outcome = await byName('registrations.list').execute(actx(), {});
    const read = JSON.parse((outcome as { summary: string }).summary);
    expect(read.notNeeded).toBe(1);
    expect(read.registrations.find((r: { id: string }) => r.id === 'reg-1')).toBeUndefined();
    const gst = read.registrations.find((r: { id: string }) => r.id === STEP);
    expect(gst).toMatchObject({ status: 'Overdue', category: 'Tax', authority: 'GSTN' });
    expect(gst.number).not.toContain('ABCDE1234F');
    const detail = await byName('registrations.get').execute(actx(), { itemId: STEP });
    expect(JSON.stringify(detail)).not.toContain('ABCDE1234F');
    expect(JSON.parse((detail as { summary: string }).summary)).toMatchObject({ applies: true, why: 'Turnover', startsFilings: [{ name: 'GSTR-3B' }], notAskedForYet: ['PAN'] });
  });

  it('keeps a date this request leaves out, and clears one given as null', async () => {
    await byName('registrations.setDates').execute(actx(), { itemId: STEP, expiresOn: '2027-01-01' });
    expect(credentials.setRegistrationDates).toHaveBeenLastCalledWith(person('manager'), { engagementId: CLIENT, stepId: STEP, issuedOn: '2026-01-01', expiresOn: '2027-01-01', renewEveryMonths: 12 });
    await byName('registrations.setDates').execute(actx(), { itemId: STEP, renewEveryMonths: null });
    expect(credentials.setRegistrationDates).toHaveBeenLastCalledWith(person('manager'), { engagementId: CLIENT, stepId: STEP, issuedOn: '2026-01-01', expiresOn: null, renewEveryMonths: null });
  });

  it('refuses an expiry before the saved issue date, as the route does', async () => {
    expect(await byName('registrations.setDates').execute(actx(), { itemId: STEP, expiresOn: '2025-01-01' })).toEqual({ ok: false, error: 'The expiry date is before the issue date.' });
    await expect(byName('registrations.setDates').preview(actx(), { itemId: STEP, expiresOn: '2025-01-01' })).rejects.toThrow('before the issue date');
    expect(byName('registrations.setDates').input.safeParse({ itemId: STEP, renewEveryMonths: 0 }).success).toBe(false);
    expect(byName('registrations.setDates').input.safeParse({ itemId: STEP, issuedOn: 'soon' }).success).toBe(false);
    expect(credentials.setRegistrationDates).not.toHaveBeenCalled();
  });

  it('undoes the dates, the fields and the ticks', async () => {
    const dates = await byName('registrations.setDates').execute(actx(), { itemId: STEP, expiresOn: '2027-01-01' });
    expect((await byName('registrations.setDates').undo!(actx(), (dates as { undo: never }).undo)).ok).toBe(true);
    expect(credentials.setRegistrationDates).toHaveBeenLastCalledWith(person('manager'), { engagementId: CLIENT, stepId: STEP, issuedOn: '2026-01-01', expiresOn: null, renewEveryMonths: 12 });
    const fields = await byName('registrations.saveFields').execute(actx(), inputOf('registrations.saveFields'));
    expect((await byName('registrations.saveFields').undo!(actx(), (fields as { undo: never }).undo)).ok).toBe(true);
    expect(inputs.saveSubjectFields).toHaveBeenLastCalledWith(person('manager'), expect.objectContaining({ kind: 'registration', key: STEP, values: { arn: null } }));
    const tick = await byName('registrations.tickChecklist').execute(actx(), inputOf('registrations.tickChecklist'));
    expect((await byName('registrations.tickChecklist').undo!(actx(), (tick as { undo: never }).undo)).ok).toBe(true);
    expect(ticks.setChecklistTick).toHaveBeenLastCalledWith(person('manager'), expect.objectContaining({ subjectKind: 'registration', itemKey: 'documents', checked: false }));
  });

  it('never reads or returns another client\'s facts', async () => {
    credentials.listRegistrationFacts.mockImplementation(async () => ({ [OTHER]: facts() }));
    const read = JSON.parse(((await byName('registrations.list').execute(actx(), {})) as { summary: string }).summary);
    expect(read.registrations.find((r: { id: string }) => r.id === STEP).number).toBeNull();
    expect(credentials.listRegistrationFacts).toHaveBeenCalledWith(person('manager'), { engagementId: CLIENT });
  });
});
