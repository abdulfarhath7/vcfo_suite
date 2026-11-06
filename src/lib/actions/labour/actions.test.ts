import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRole, AuthContext } from '@/auth/guards';
import type { ActionContext, ActionResult, AnyAction } from '../types';

/**
 * The labour register actions: who sees each and at which tier, that a card only reads, that they run
 * as the person on the locked client, and that a period closes only when code says it can. The
 * assumptions and generate routes share these functions, so their answers are checked here too.
 */
vi.mock('@/db/client', () => ({ db: {} }));

const CLIENT = 'a0000000-0000-4000-8000-00000000000a';
const OTHER = 'b0000000-0000-4000-8000-00000000000b';
const BATCH = 'c0000000-0000-4000-8000-00000000000c';

const repo = vi.hoisted(() => ({ getBatch: vi.fn(), listBatches: vi.fn(), markReady: vi.fn(), openBatch: vi.fn(), reopenInputs: vi.fn(), updateBatch: vi.fn() }));
vi.mock('@/db/repositories/labour-registers', () => repo);
const loadBatchView = vi.hoisted(() => vi.fn());
vi.mock('@/views/labour-registers/load-batch', () => ({ loadBatchView }));
const generateRegisters = vi.hoisted(() => vi.fn());
vi.mock('./generate', () => ({ generateRegisters }));
const getEngagementById = vi.hoisted(() => vi.fn());
vi.mock('@/db/repositories/engagements', () => ({ getEngagementById }));
const guard = vi.hoisted(() => vi.fn());
vi.mock('@/auth/guards', () => ({ requireAnyRole: () => guard() }));

const { actions } = await import('./index');
const { refusing } = await import('../shared');
const assumptionsRoute = (await import('../../../../app/api/labour-registers/assumptions/route')).POST;
const generateRoute = (await import('../../../../app/api/labour-registers/generate/route')).POST;

const byName = (name: string) => actions.find((a: AnyAction) => a.name === name)!;
const person = (role: AppRole): AuthContext => ({ userId: 'u1', email: 'u@x.test', name: 'U', role });
const actx = (role: AppRole = 'manager', engagementId: string | null = CLIENT): ActionContext => ({ auth: person(role), engagementId, conversationId: null, runId: 'r', now: new Date('2026-11-06T10:00:00Z'), via: 'ask' });

const STAFF = ['super_admin', 'admin', 'manager', 'intern'];
const openBatch = { id: BATCH, engagementId: CLIENT, stateCode: 'TG', periodFrom: '2026-10-01', periodTo: '2026-10-31', status: 'gathering', markedReadyAt: null, reopenCount: 0, assumptions: { weekOff: 'sun' } };
const closedBatch = { ...openBatch, markedReadyAt: new Date('2026-11-01') };
const view = {
  status: 'gathering',
  locked: false,
  period: { from: '2026-10-01', to: '2026-10-31' },
  uploads: { paysheet: { fileName: 'pay.xlsx', rowCount: 12 } },
  attendanceAssumed: false,
  sphere: 'state',
  sentence: 'Twelve employees across four acts.',
  documents: [],
  readiness: { canClose: true, employees: 12, registers: 8, acts: 4, lines: [{ kind: 'done', text: 'Paysheet in.' }, { kind: 'short', text: 'No muster roll.' }] },
};

const TABLE: Array<[string, string, object]> = [
  ['labour.listBatches', 'T0', {}],
  ['labour.batchStatus', 'T0', { batchId: BATCH }],
  ['labour.openBatch', 'T2', { stateCode: 'TG', periodFrom: '2026-10-01', periodTo: '2026-10-31' }],
  ['labour.setAssumptions', 'T2', { batchId: BATCH, assumptions: { weekOff: 'sat-sun', dailyHours: 8 } }],
  ['labour.markReady', 'T3', { batchId: BATCH }],
  ['labour.reopen', 'T2', { batchId: BATCH, reason: 'Wrong wages' }],
  ['labour.generate', 'T2', { batchId: BATCH }],
];
const CLOSED_ONLY = new Set(['labour.reopen', 'labour.generate']);
const undoFrom = (outcome: ActionResult) => (outcome.ok ? outcome.undo! : null);
const needsCard = (a: AnyAction) => a.tier === 'T2' || a.tier === 'T3';
const writes = [repo.markReady, repo.openBatch, repo.reopenInputs, repo.updateBatch, generateRegisters];
const stateFor = (name: string) => repo.getBatch.mockResolvedValue(CLOSED_ONLY.has(name) ? closedBatch : openBatch);

beforeEach(() => {
  vi.clearAllMocks();
  guard.mockResolvedValue({ ok: true, ctx: person('manager') });
  repo.getBatch.mockResolvedValue(openBatch);
  repo.listBatches.mockResolvedValue([openBatch]);
  repo.markReady.mockResolvedValue(closedBatch);
  repo.openBatch.mockResolvedValue(openBatch);
  repo.reopenInputs.mockResolvedValue(openBatch);
  repo.updateBatch.mockResolvedValue(openBatch);
  loadBatchView.mockResolvedValue(view);
  getEngagementById.mockResolvedValue({ companyName: 'Northwind' });
  generateRegisters.mockResolvedValue({ kind: 'done', documents: [{ formId: 'F1', documentId: 'd', fileName: 'f.xlsx', format: 'xlsx', built: true }, { formId: 'F2', documentId: 'e', fileName: 'g.xlsx', format: 'xlsx', built: false }], blocked: [{ formId: 'F3', reason: 'No wages.' }], deferred: [], suppressed: [] });
});

describe('the labour register actions', () => {
  it('holds exactly the actions in the table, with that tier, for staff', () => {
    expect(actions.map((a: AnyAction) => a.name).sort()).toEqual(TABLE.map(([name]) => name).sort());
    for (const [name, tier] of TABLE) {
      expect(byName(name).tier, name).toBe(tier);
      expect([...byName(name).roles].sort(), name).toEqual([...STAFF].sort());
    }
  });

  it('offers nothing to a client, a developer or a partner, and no attestation at all', () => {
    for (const action of actions) {
      for (const role of ['client', 'developer', 'partner']) expect(action.roles).not.toContain(role);
      expect(action.name).not.toMatch(/attest/i);
    }
  });

  it.each(TABLE)('%s takes no client, and no statement of accuracy, in its input', (name, _tier, input) => {
    const parsed = byName(name).input.parse({ ...input, engagementId: OTHER, accuracyConfirmed: true });
    const text = JSON.stringify(parsed);
    expect(text).not.toContain(OTHER);
    expect(text).not.toContain('accuracyConfirmed');
  });

  it.each(TABLE.filter(([, tier]) => tier !== 'T0'))('%s only prepares a card on preview, and writes nothing', async (name, _tier, input) => {
    stateFor(name);
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

  it.each(TABLE)('%s runs as the person, on the locked client', async (name, _tier, input) => {
    stateFor(name);
    const action = byName(name);
    const outcome = await action.execute(actx(), action.input.parse(input));
    expect(outcome.ok, `${name}: ${JSON.stringify(outcome)}`).toBe(true);
    const calls = [repo.getBatch, repo.listBatches, repo.openBatch].flatMap((fn) => fn.mock.calls);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect((call[0] as AuthContext).userId).toBe('u1');
  });

  it('needs a locked client for everything', async () => {
    for (const [name, , input] of TABLE) {
      stateFor(name);
      const action = byName(name);
      const parsed = action.input.parse(input);
      const outcome = await (needsCard(action) && name !== 'labour.openBatch'
        ? refusing(async () => {
            await action.preview(actx('manager', null), parsed);
            return { ok: true, summary: '' };
          })
        : action.execute(actx('manager', null), parsed));
      expect(outcome.ok, name).toBe(false);
    }
  });

  it('refuses a batch on another client, or one the person cannot see, as if it were not there', async () => {
    for (const [name, , input] of TABLE.filter(([n]) => n !== 'labour.listBatches' && n !== 'labour.openBatch')) {
      const action = byName(name);
      repo.getBatch.mockResolvedValue({ ...openBatch, engagementId: OTHER });
      expect(await action.execute(actx(), action.input.parse(input)), name).toEqual({ ok: false, error: expect.stringMatching(/not on this project/) });
      repo.getBatch.mockResolvedValue(null);
      expect(await action.execute(actx(), action.input.parse(input)), name).toEqual({ ok: false, error: 'That register batch is not available.' });
    }
    for (const write of writes) expect(write).not.toHaveBeenCalled();
  });

  it('turns a repository refusal into a sentence, and leaves a fault as a fault', async () => {
    repo.reopenInputs.mockRejectedValueOnce(new Error('not permitted'));
    repo.getBatch.mockResolvedValue(closedBatch);
    const reopen = byName('labour.reopen');
    expect(await reopen.execute(actx(), { batchId: BATCH, reason: 'Wrong wages' })).toEqual({ ok: false, error: 'You cannot do this on this register batch.' });
    repo.reopenInputs.mockRejectedValueOnce(new Error('database down'));
    await expect(reopen.execute(actx(), { batchId: BATCH, reason: 'Wrong wages' })).rejects.toThrow('database down');
  });

  it('closes a period with the confirmation on the card and the readiness from code', async () => {
    const close = byName('labour.markReady');
    const draft = await close.preview(actx(), { batchId: BATCH });
    expect(draft!.recipients).toEqual([]);
    expect(draft!.rows[0]!.displayNew).toContain('I confirm the employee, attendance and wage data');
    expect(draft!.rows[0]!.displayNew).toContain('No muster roll.');
    const outcome = await close.execute(actx(), { batchId: BATCH });
    expect(repo.markReady).toHaveBeenCalledWith(person('manager'), { batchId: BATCH, accuracyConfirmed: true, readiness: view.readiness });
    expect(outcome).toMatchObject({ ok: true, undo: { batchId: BATCH } });
    await close.undo!(actx(), { batchId: BATCH });
    expect(repo.reopenInputs).toHaveBeenCalledWith(person('manager'), { batchId: BATCH, reason: expect.stringContaining('Undone') });
  });

  it('refuses to close while something blocks, even if the data changed after the card', async () => {
    const close = byName('labour.markReady');
    loadBatchView.mockResolvedValue({ ...view, readiness: { ...view.readiness, canClose: false, lines: [{ kind: 'blocked', text: 'No paysheet.' }] } });
    await expect(close.preview(actx(), { batchId: BATCH })).rejects.toThrow('This period cannot close yet: No paysheet.');
    expect(await close.execute(actx(), { batchId: BATCH })).toEqual({ ok: false, error: 'This period cannot close yet: No paysheet.' });
    expect(repo.markReady).not.toHaveBeenCalled();
    repo.getBatch.mockResolvedValue(closedBatch);
    await expect(close.preview(actx(), { batchId: BATCH })).rejects.toThrow(/already closed/);
  });

  it('refuses a state it does not know and a period that runs backwards', async () => {
    const open = byName('labour.openBatch');
    await expect(open.preview(actx(), { stateCode: 'ZZ', periodFrom: '2026-10-01', periodTo: '2026-10-31' })).rejects.toThrow(/state code/);
    await expect(open.preview(actx(), { stateCode: 'TG', periodFrom: '2026-10-31', periodTo: '2026-10-01' })).rejects.toThrow(/ends before/);
    await open.execute(actx(), { stateCode: 'TG', periodFrom: '2026-10-01', periodTo: '2026-10-31' });
    expect(repo.openBatch).toHaveBeenCalledWith(person('manager'), { engagementId: CLIENT, stateCode: 'TG', periodFrom: '2026-10-01', periodTo: '2026-10-31' });
  });

  it('merges a basis over what is there, spells it out on the card, and undoes to what was there', async () => {
    const set = byName('labour.setAssumptions');
    const draft = await set.preview(actx(), { batchId: BATCH, assumptions: { dailyHours: 8, establishment: { shiftName: 'General' } } });
    expect(draft!.rows[0]!.displayNew).toBe('Hours in a day: 8. Establishment shiftName: General');
    await expect(set.preview(actx(), { batchId: BATCH, assumptions: {} })).rejects.toThrow(/nothing to record/);
    const outcome = await set.execute(actx(), { batchId: BATCH, assumptions: { dailyHours: 8 } });
    expect(repo.updateBatch).toHaveBeenCalledWith(person('manager'), BATCH, { assumptions: { weekOff: 'sun', dailyHours: 8 } });
    expect(outcome).toMatchObject({ ok: true, undo: { batchId: BATCH, previous: { weekOff: 'sun' } } });
    await set.undo!(actx(), undoFrom(outcome));
    expect(repo.updateBatch).toHaveBeenLastCalledWith(person('manager'), BATCH, { assumptions: { weekOff: 'sun' } });
  });

  it('leaves a closed period\'s basis alone', async () => {
    repo.getBatch.mockResolvedValue(closedBatch);
    const set = byName('labour.setAssumptions');
    await expect(set.preview(actx(), { batchId: BATCH, assumptions: { dailyHours: 8 } })).rejects.toThrow(/closed/);
    expect(await set.execute(actx(), { batchId: BATCH, assumptions: { dailyHours: 8 } })).toEqual({ ok: false, error: expect.stringContaining('closed') });
    expect(await set.undo!(actx(), { batchId: BATCH, previous: {} })).toEqual({ ok: false, error: expect.stringContaining('closed') });
    expect(repo.updateBatch).not.toHaveBeenCalled();
  });

  it('builds only from a closed period, with the company on the record, and reports what it could not build', async () => {
    const generate = byName('labour.generate');
    await expect(generate.preview(actx(), { batchId: BATCH })).rejects.toThrow(/Mark the inputs ready/);
    repo.getBatch.mockResolvedValue(closedBatch);
    const outcome = await generate.execute(actx(), { batchId: BATCH, formats: ['xlsx'] });
    expect(generateRegisters).toHaveBeenCalledWith(person('manager'), { batchId: BATCH, formats: ['xlsx'], companyName: 'Northwind' });
    expect(outcome).toEqual({ ok: true, summary: 'Built 1 file, and 1 came from storage. Not built: F3: No wages.' });
    generateRegisters.mockResolvedValue({ kind: 'not_ready' });
    expect(await generate.execute(actx(), { batchId: BATCH })).toEqual({ ok: false, error: expect.stringContaining('Mark the inputs ready') });
  });
});

describe('the labour routes that share these functions', () => {
  const post = (body: unknown) => new Request('http://x/api', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

  it('assumptions answers as before: merged, not found and closed', async () => {
    const done = await assumptionsRoute(post({ batchId: BATCH, assumptions: { dailyHours: 8 } }));
    expect(await done.json()).toEqual({ batchId: BATCH, assumptions: { weekOff: 'sun', dailyHours: 8 } });
    repo.getBatch.mockResolvedValue(null);
    expect((await assumptionsRoute(post({ batchId: BATCH, assumptions: {} }))).status).toBe(404);
    repo.getBatch.mockResolvedValue(closedBatch);
    expect((await assumptionsRoute(post({ batchId: BATCH, assumptions: {} }))).status).toBe(409);
  });

  it('generate answers as before: built, not found and not ready, and passes the body through', async () => {
    const done = await generateRoute(post({ batchId: BATCH, companyName: 'Northwind' }));
    expect(generateRegisters).toHaveBeenCalledWith(person('manager'), { batchId: BATCH, companyName: 'Northwind' });
    expect(done.status).toBe(200);
    expect((await done.json()).documents).toHaveLength(2);
    generateRegisters.mockResolvedValue({ kind: 'not_found' });
    expect((await generateRoute(post({ batchId: BATCH }))).status).toBe(404);
    generateRegisters.mockResolvedValue({ kind: 'not_ready' });
    expect((await generateRoute(post({ batchId: BATCH }))).status).toBe(409);
  });

  it('both stop at the guard for a role it refuses', async () => {
    guard.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    expect((await assumptionsRoute(post({ batchId: BATCH, assumptions: {} }))).status).toBe(403);
    expect((await generateRoute(post({ batchId: BATCH }))).status).toBe(403);
    expect(generateRegisters).not.toHaveBeenCalled();
  });
});
