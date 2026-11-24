import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * "Fill into app", with the repositories, the card's apply and the step gate replaced by a small
 * in-memory project. What must hold: steps go in checklist order, a step's clear rows are applied and
 * the step submitted before the next step's rows are checked again, a manager step stops the run,
 * Manual marks rows saved only when the page holds the card's value, and a client or a second run
 * on the same card is refused.
 */

const lead: AuthContext = { userId: 'lead-1', email: 'l@x.test', name: 'Lead', role: 'intern', internId: 'int-1' };
const client: AuthContext = { userId: 'cl-1', email: 'c@x.test', name: 'Client', role: 'client', clientId: 'c-1' };

/** Steps open in this order; a step is locked until the one before it is complete. */
const ORDER = ['pre-1', 'pre-2', 'pre-4', 'pre-5'];
type Slice = { complete?: boolean; responses?: Record<string, string> };
let checklist: Record<string, Slice> = {};
const isOpen = (stepId: string) => {
  const i = ORDER.indexOf(stepId);
  return i <= 0 || checklist[ORDER[i - 1]!]?.complete === true || ORDER.slice(0, i).every((id) => checklist[id]?.complete);
};

type Row = {
  id: string;
  action: string;
  target: Record<string, unknown>;
  newValue: unknown;
  oldValue: unknown;
  label: string;
  displayNew: string;
  status: string;
  checks: Array<{ rule: string; ok: boolean; message?: string }>;
  heldReason: string | null;
};
let found: { changeset: Record<string, unknown>; rows: Row[]; companyName: string; viewerId: string; owner: boolean; manager: boolean } | null = null;

const updateRows = vi.fn(async (_ctx: unknown, card: typeof found, updates: Array<{ id: string; patch: Partial<Row> }>) => {
  for (const u of updates) {
    const row = card!.rows.find((r) => r.id === u.id);
    if (row) Object.assign(row, u.patch);
  }
});
const setStatus = vi.fn();
vi.mock('@/db/repositories/ask-changesets', () => ({
  getAskChangesetForDecision: vi.fn(async () => (found ? { ...found, rows: found.rows.map((r) => ({ ...r })) } : null)),
  rowNeedsManager: (row: { target: { needsManager?: boolean } }) => row.target.needsManager === true,
  setAskChangesetStatus: (...a: unknown[]) => setStatus(...a),
  updateAskChangesetRows: async (ctx: unknown, _card: unknown, updates: Array<{ id: string; patch: Partial<Row> }>) => updateRows(ctx, found, updates),
}));
vi.mock('@/db/repositories/ask-conversations', () => ({ getAskConversation: vi.fn(async () => ({ id: 'conv-1' })) }));
const appendMessage = vi.fn(async () => ({ id: 'msg-1' }));
vi.mock('@/db/repositories/ask-messages', () => ({ appendAskMessage: (...a: unknown[]) => appendMessage(...(a as [])) }));

type Run = { id: string; workflow: string; status: string; state: unknown; conversationId: string | null; profileId: string };
let run: Run | null = null;
const openRun = vi.fn(async (): Promise<Run | null> => null);
vi.mock('@/db/repositories/ask-runs', () => ({
  createAskRun: vi.fn(async (ctx: AuthContext, input: { conversationId: string | null; workflow: string; status: string; state: unknown }) => {
    run = { id: 'run-1', workflow: input.workflow, status: input.status, state: input.state, conversationId: input.conversationId, profileId: ctx.userId };
    return { ...run };
  }),
  findOpenAskFillRun: () => openRun(),
  getOwnAskRun: vi.fn(async (ctx: AuthContext, id: string) => (run && run.id === id && run.profileId === ctx.userId ? { ...run } : null)),
  lockAskRun: vi.fn(async () => true),
  updateAskRun: vi.fn(async (_ctx: unknown, _id: string, patch: { status?: string; state?: unknown }) => {
    if (!run) return;
    if (patch.status) run.status = patch.status;
    if (patch.state !== undefined) run.state = JSON.parse(JSON.stringify(patch.state));
  }),
  askRunActor: vi.fn(async () => (run ? { ctx: lead, run: { ...run } } : null)),
}));
const audit = vi.fn();
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: (...a: unknown[]) => audit(...a) }));
const submit = vi.fn(async (_ctx: unknown, _eng: string, stepId: string) => {
  checklist[stepId] = { ...checklist[stepId], complete: true };
  return { outcome: 'submitted' as const };
});
vi.mock('@/db/repositories/engagements', () => ({
  getEngagementById: vi.fn(async () => ({ id: 'eng-1' })),
  checklistStateFromRow: () => checklist,
}));
vi.mock('@/lib/actions/checklist/submit-step', () => ({ submitStepWithNotices: (...a: [unknown, string, string]) => submit(...a) }));
vi.mock('@/lib/actions/checklist/rules', () => ({
  responseKey: (t: { fieldId: string; group?: string; entryId?: string }) => (t.group && t.entryId ? `${t.group}.${t.entryId}.${t.fieldId}` : t.fieldId),
  fieldOf: (t: { fieldId: string }) => ({ label: `Label ${t.fieldId}` }),
}));
const applyRow = vi.fn(async () => ({ patch: { status: 'applied', error: null } }));
const recheckRows = vi.fn(async (_actx: unknown, rows: Row[]) =>
  rows.map((row) =>
    isOpen(String(row.target.stepId))
      ? { id: row.id, patch: { status: 'proposed', heldReason: null, checks: [{ rule: 'gate', ok: true }] } }
      : { id: row.id, patch: { status: 'held', heldReason: 'Held: not open.', checks: [{ rule: 'gate', ok: false, message: 'Held: not open.' }] } },
  ),
);
vi.mock('@/lib/ask/changeset/apply', () => ({
  OPEN: ['proposed', 'partly_applied'],
  OPEN_ROW: new Set(['proposed', 'edited', 'accepted', 'held', 'failed']),
  applyRow: (...a: unknown[]) => applyRow(...(a as [])),
  recheckRows: (...a: [unknown, Row[]]) => recheckRows(...a),
}));
vi.mock('@/lib/checklist/checklist-step-gate', () => ({
  checklistGateViewerFrom: () => 'staff',
  gateActiveCatalog: () => null,
  getStepGate: (_catalog: unknown, stepId: string) => (isOpen(stepId) ? { kind: 'open' } : { kind: 'locked', blockedByTitle: 'the step before' }),
}));
vi.mock('@/lib/incorporation/pre-inc-direct-flow', () => ({
  MANAGER_APPROVAL_STEP_ID: 'pre-2',
  isDirectFlowStep: (id: string) => id !== 'pre-2',
  isDirectFlowStepComplete: (_id: string, slice: Slice | undefined) => slice?.complete === true,
}));
vi.mock('@/lib/projects/legacy-engagement-ids', () => ({ engagementDbId: (id: string) => id }));
const send = vi.fn(async () => undefined);
vi.mock('@/jobs/client', () => ({ inngest: { send: (...a: unknown[]) => send(...(a as [])) } }));

const { acceptManualStep, FillRefused, fillStep, startFill, stopFill } = await import('./run');
const { planFill } = await import('./plan');

const makeRow = (id: string, stepId: string, patch: Partial<Row> = {}): Row => ({
  id,
  action: 'checklist.setResponse',
  target: { engagementId: 'eng-1', stepId, fieldId: id },
  newValue: `value-${id}`,
  oldValue: '',
  label: id,
  displayNew: `value-${id}`,
  status: 'proposed',
  checks: [],
  heldReason: null,
  ...patch,
});

function setCard(rows: Row[]) {
  found = {
    changeset: { id: 'cs-1', status: 'proposed', expiresAt: new Date(Date.now() + 86_400_000), engagementId: 'eng-1', conversationId: 'conv-1', runId: null },
    rows,
    companyName: 'Bonterra',
    viewerId: 'lead-1',
    owner: true,
    manager: false,
  };
}

const rowOf = (id: string) => found!.rows.find((r) => r.id === id)!;

beforeEach(() => {
  vi.clearAllMocks();
  checklist = {};
  run = null;
  found = null;
  openRun.mockResolvedValue(null);
});

describe('planFill', () => {
  it('groups checklist rows by step in checklist order and leaves out other rows', () => {
    const plan = planFill([
      makeRow('c', 'pre-5'),
      makeRow('a', 'pre-1'),
      makeRow('vault', 'pre-1', { action: 'documents.fileToVault' }),
      makeRow('b', 'pre-4'),
      makeRow('a2', 'pre-1'),
      makeRow('gone', 'pre-13', { status: 'undone' }),
    ]);
    expect(plan.map((p) => p.stepId)).toEqual(['pre-1', 'pre-4', 'pre-5']);
    expect(plan[0]!.rowIds).toEqual(['a', 'a2']);
    expect(plan[0]!.title).toBe('Client Details');
  });
});

describe('auto mode', () => {
  it('applies the clear rows, submits, then the next step rows read clear and are applied', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('proposed', 'pre-4', { status: 'held', checks: [{ rule: 'gate', ok: false }], heldReason: 'Held' })]);
    checklist = { 'pre-2': { complete: true } };
    const started = await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    expect(started.view.current).toBe('pre-1');
    expect(started.view.status).toBe('running');
    expect(send).toHaveBeenCalledWith({ name: 'ask/fill.run', data: { runId: 'run-1', profileId: 'lead-1' } });

    const first = await fillStep(lead, 'run-1', 'pre-1');
    expect(applyRow).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(lead, 'eng-1', 'pre-1');
    expect(rowOf('name').status).toBe('applied');
    // pre-2 is already complete, so the run moves on to pre-4, whose row the gate no longer holds.
    expect(first.next).toBe('pre-4');
    expect(rowOf('proposed').status).toBe('proposed');
    expect(rowOf('proposed').heldReason).toBeNull();

    const second = await fillStep(lead, 'run-1', 'pre-4');
    expect(second).toMatchObject({ next: null, status: 'done' });
    expect(rowOf('proposed').status).toBe('applied');
    expect(audit.mock.calls.map((c) => (c[1] as { action: string }).action)).toEqual(['ask.fill.step', 'ask.fill.step']);
    // The closing line names steps, never values.
    const text = (appendMessage.mock.calls.at(-1) as unknown as [unknown, unknown, { text: string }])[2].text;
    expect(text).toContain('I filled 2 steps for Bonterra');
    expect(text).not.toContain('value-name');
  });

  it('stops at the manager approval step and says why', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('draft', 'pre-2')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    const result = await fillStep(lead, 'run-1', 'pre-1');
    expect(result.next).toBeNull();
    expect(result.status).toBe('stopped');
    expect(result.stopReason).toMatch(/manager's approval/);
    expect(rowOf('draft').status).toBe('proposed');
    expect(applyRow).toHaveBeenCalledTimes(1);
  });

  it('hands a numeric-looking answer to the apply as text', async () => {
    // The JSONB column reads "1500000" back as the number 1500000.
    setCard([makeRow('capital', 'pre-1', { newValue: 1500000 })]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    await fillStep(lead, 'run-1', 'pre-1');
    expect((applyRow.mock.calls[0] as unknown as [unknown, Row])[1].newValue).toBe('1500000');
  });

  it('does not submit a step when one of its values failed to save', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('bad', 'pre-1')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    applyRow.mockResolvedValueOnce({ patch: { status: 'applied', error: null } }).mockResolvedValueOnce({ patch: { status: 'failed', error: 'no' } } as never);
    const result = await fillStep(lead, 'run-1', 'pre-1');
    expect(submit).not.toHaveBeenCalled();
    expect(result).toMatchObject({ next: null, status: 'stopped' });
    expect(result.stopReason).toMatch(/not submitted because bad could not be saved/);
  });

  it('refuses an auto step on a manual run', async () => {
    setCard([makeRow('name', 'pre-1')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'manual' });
    await expect(fillStep(lead, 'run-1', 'pre-1')).rejects.toBeInstanceOf(FillRefused);
    expect(applyRow).not.toHaveBeenCalled();
  });
});

describe('manual mode', () => {
  it('marks rows saved when the page holds the card value, and left when it does not', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('pan', 'pre-1')]);
    const started = await startFill(lead, { changesetId: 'cs-1', mode: 'manual' });
    expect(started.view.status).toBe('waiting_user');
    expect(send).not.toHaveBeenCalled();
    // The page being typed carries the raw values.
    expect(started.view.steps[0]!.rows.map((r) => r.value)).toEqual(['value-name', 'value-pan']);

    await expect(acceptManualStep(lead, 'run-1', 'pre-1')).rejects.toThrow(/not submitted yet/);
    checklist['pre-1'] = { complete: true, responses: { name: 'value-name', pan: 'changed on the page' } };
    const view = await acceptManualStep(lead, 'run-1', 'pre-1');
    expect(rowOf('name').status).toBe('applied');
    expect(rowOf('pan')).toMatchObject({ status: 'skipped', error: 'Changed by you on the page.' });
    expect(view.status).toBe('done');
    expect(applyRow).not.toHaveBeenCalled();
  });

  it('counts a numeric-looking answer as saved when the page holds the same text', async () => {
    setCard([makeRow('capital', 'pre-1', { newValue: 1500000 })]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'manual' });
    checklist['pre-1'] = { complete: true, responses: { capital: '1500000' } };
    await acceptManualStep(lead, 'run-1', 'pre-1');
    expect(rowOf('capital').status).toBe('applied');
  });

  it('Stop marks only the current step and keeps the rest of the card', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('later', 'pre-4')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'manual' });
    const view = await stopFill(lead, 'run-1');
    expect(view.status).toBe('stopped');
    expect(view.steps.map((s) => s.status)).toEqual(['stopped', 'pending']);
    expect(rowOf('later').status).toBe('proposed');
  });
});

describe('refusals', () => {
  it('refuses a client before anything is read or written', async () => {
    setCard([makeRow('name', 'pre-1')]);
    await expect(startFill(client, { changesetId: 'cs-1', mode: 'auto' })).rejects.toMatchObject({ status: 403 });
    expect(run).toBeNull();
  });

  it('picks up the open run on the same card instead of starting a second one', async () => {
    setCard([makeRow('name', 'pre-1')]);
    openRun.mockResolvedValue({ id: 'run-0', workflow: 'fill', status: 'waiting_user', state: { mode: 'manual', current: 'pre-1', steps: [{ stepId: 'pre-1', status: 'active' }] }, conversationId: null, profileId: 'lead-1' });
    const started = await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    expect(started).toMatchObject({ runId: 'run-0', mode: 'manual', view: { status: 'waiting_user', current: 'pre-1' } });
    expect(run).toBeNull();
  });

  it('refuses a card with no checklist rows', async () => {
    setCard([makeRow('vault', 'pre-1', { action: 'documents.fileToVault' })]);
    await expect(startFill(lead, { changesetId: 'cs-1', mode: 'auto' })).rejects.toMatchObject({ status: 400 });
  });
});
