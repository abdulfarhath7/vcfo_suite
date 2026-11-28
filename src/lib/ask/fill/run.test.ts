import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * "Fill into app" (PLAN K), with the repositories, the card's apply and the step gate replaced by a
 * small in-memory project. What must hold: steps go in checklist order, every step's clear rows are
 * saved as drafts (steps not open yet too) and nothing is submitted, a manager step is left and the
 * run goes on, Manual accept needs the page saved (not submitted), the summary counts complete and
 * incomplete steps, "Submit ready steps" stops at the first incomplete step, and a client or a
 * second run on the same card is refused.
 */

const lead: AuthContext = { userId: 'lead-1', email: 'l@x.test', name: 'Lead', role: 'intern', internId: 'int-1' };
const client: AuthContext = { userId: 'cl-1', email: 'c@x.test', name: 'Client', role: 'client', clientId: 'c-1' };

/** Steps open in this order; a step is locked until the one before it is complete. */
const ORDER = ['pre-1', 'pre-2', 'pre-4', 'pre-5'];
type Slice = { complete?: boolean; responses?: Record<string, string>; missing?: string[] };
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
let otherStep: { stepTitle: string; value: string } | null = null;
vi.mock('@/lib/actions/checklist/rules', () => ({
  responseKey: (t: { fieldId: string; group?: string; entryId?: string }) => (t.group && t.entryId ? `${t.group}.${t.entryId}.${t.fieldId}` : t.fieldId),
  fieldOf: (t: { fieldId: string }) => ({ label: `Label ${t.fieldId}` }),
  otherStepValue: () => otherStep,
}));
vi.mock('@/lib/incorporation/step-completeness', () => ({
  stepCompleteness: ({ stepId, state }: { stepId: string; state: Record<string, Slice> }) => {
    const missing = state[stepId]?.missing ?? [];
    return { complete: missing.length === 0, missing: missing.length, labels: missing };
  },
}));
const applyRow = vi.fn(async () => ({ patch: { status: 'applied', error: null } }));
// The rules take a draft on a step not open yet (PLAN K); a row marked `owner` stays held.
const recheckRows = vi.fn(async (_actx: unknown, rows: Row[]) =>
  rows.map((row) =>
    row.target.owner === 'client'
      ? { id: row.id, patch: { status: 'held', heldReason: 'Held: The client fills this field.', checks: [{ rule: 'owner', ok: false, message: 'Held: The client fills this field.' }] } }
      : { id: row.id, patch: { status: 'proposed', heldReason: null, checks: [{ rule: 'gate', ok: true }] } },
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
  getStepGate: (_catalog: unknown, stepId: string) => (isOpen(stepId) ? { kind: 'active', canEdit: true } : { kind: 'locked', blockedByTitle: 'the step before', canEdit: true }),
}));
vi.mock('@/lib/incorporation/pre-inc-direct-flow', () => ({
  MANAGER_APPROVAL_STEP_ID: 'pre-2',
  isDirectFlowStep: (id: string) => id !== 'pre-2',
  isDirectFlowStepComplete: (_id: string, slice: Slice | undefined) => slice?.complete === true,
}));
vi.mock('@/lib/projects/legacy-engagement-ids', () => ({ engagementDbId: (id: string) => id }));
const send = vi.fn(async () => undefined);
vi.mock('@/jobs/client', () => ({ inngest: { send: (...a: unknown[]) => send(...(a as [])) } }));

const { acceptManualStep, FillRefused, fillStartedLine, fillStep, fillSummary, startFill, stopFill, submitReadySteps } = await import('./run');
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
  otherStep = null;
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

const lastText = () => (appendMessage.mock.calls.at(-1) as unknown as [unknown, unknown, { text: string; answer: Record<string, unknown> }])[2];

describe('auto mode', () => {
  it('saves every step as a draft in order, a step not open yet too, and submits nothing', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('proposed', 'pre-4', { status: 'held', checks: [{ rule: 'gate', ok: false }], heldReason: 'Held' })]);
    const started = await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    expect(started.view.current).toBe('pre-1');
    expect(started.view.status).toBe('running');
    expect(send).toHaveBeenCalledWith({ name: 'ask/fill.run', data: { runId: 'run-1', profileId: 'lead-1' } });

    const first = await fillStep(lead, 'run-1', 'pre-1');
    expect(rowOf('name').status).toBe('applied');
    // pre-1 is not submitted, so pre-4 is still not open: it is filled anyway, as a draft.
    expect(first.next).toBe('pre-4');
    expect(rowOf('proposed')).toMatchObject({ status: 'proposed', heldReason: null });

    const second = await fillStep(lead, 'run-1', 'pre-4');
    expect(second).toMatchObject({ next: null, status: 'done' });
    expect(rowOf('proposed').status).toBe('applied');
    expect(submit).not.toHaveBeenCalled();
    expect((run!.state as { steps: Array<{ stepId: string; early?: boolean }> }).steps).toEqual([
      expect.objectContaining({ stepId: 'pre-1', status: 'done' }),
      expect.objectContaining({ stepId: 'pre-4', status: 'done', early: true }),
    ]);
    const audits = audit.mock.calls.map((c) => c[1] as { action: string; summary: string; metadata: Record<string, unknown> });
    expect(audits.map((a) => a.action)).toEqual(['ask.fill.step', 'ask.fill.step']);
    expect(audits[1]!.summary).toMatch(/before it opened/);
    expect(audits[1]!.metadata).toMatchObject({ early: true, submitted: false });
    // The closing line counts values and steps, never the values themselves.
    expect(lastText().text).toContain('Filled 2 values in 2 steps for Bonterra.');
    expect(lastText().text).not.toContain('value-name');
  });

  it('leaves the manager approval step with its reason and goes on to the next step', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('draft', 'pre-2'), makeRow('later', 'pre-4')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    const result = await fillStep(lead, 'run-1', 'pre-1');
    expect(result.next).toBe('pre-4');
    const steps = (run!.state as { steps: Array<{ stepId: string; status: string; stopReason?: string }> }).steps;
    expect(steps[1]).toMatchObject({ stepId: 'pre-2', status: 'stopped' });
    expect(steps[1]!.stopReason).toMatch(/manager's approval/);
    expect(rowOf('draft').status).toBe('proposed');
    const end = await fillStep(lead, 'run-1', 'pre-4');
    expect(end.status).toBe('done');
    expect(rowOf('later').status).toBe('applied');
  });

  it('keeps a field another role owns held, and saves the rest of the step', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('clientOnly', 'pre-1', { target: { engagementId: 'eng-1', stepId: 'pre-1', fieldId: 'clientOnly', owner: 'client' } })]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    await fillStep(lead, 'run-1', 'pre-1');
    expect(applyRow).toHaveBeenCalledTimes(1);
    expect(rowOf('name').status).toBe('applied');
    expect(rowOf('clientOnly').status).toBe('held');
  });

  it('with a scope, plans only those steps and leaves the other rows on the card', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('later', 'pre-13'), makeRow('post', 'post-1')]);
    const scope = { stepIds: ['pre-1', 'pre-2', 'pre-3', 'pre-4', 'pre-5'], label: 'Phase 1 — Name Application' };
    const started = await startFill(lead, { changesetId: 'cs-1', mode: 'auto', scope });
    expect(started.view.steps.map((s) => s.stepId)).toEqual(['pre-1']);
    expect((run!.state as { scope?: unknown }).scope).toEqual(scope);
    const result = await fillStep(lead, 'run-1', 'pre-1');
    expect(result).toMatchObject({ next: null, status: 'done' });
    expect(rowOf('later').status).toBe('proposed');
    expect(rowOf('post').status).toBe('proposed');
  });

  it('refuses plainly when the scope holds none of the card rows', async () => {
    setCard([makeRow('post', 'post-1')]);
    await expect(startFill(lead, { changesetId: 'cs-1', mode: 'auto', scope: { stepIds: ['pre-1'], label: 'Phase 1 — Name Application' } })).rejects.toThrow(
      /no values for Phase 1 — Name Application/,
    );
  });

  it('hands a numeric-looking answer to the apply as text', async () => {
    // The JSONB column reads "1500000" back as the number 1500000.
    setCard([makeRow('capital', 'pre-1', { newValue: 1500000 })]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    await fillStep(lead, 'run-1', 'pre-1');
    expect((applyRow.mock.calls[0] as unknown as [unknown, Row])[1].newValue).toBe('1500000');
  });

  it('goes on when one value failed to save, and records it', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('bad', 'pre-1'), makeRow('later', 'pre-4')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    applyRow.mockResolvedValueOnce({ patch: { status: 'applied', error: null } }).mockResolvedValueOnce({ patch: { status: 'failed', error: 'no' } } as never);
    const result = await fillStep(lead, 'run-1', 'pre-1');
    expect(submit).not.toHaveBeenCalled();
    expect(result.next).toBe('pre-4');
    expect((audit.mock.calls[0]![1] as { metadata: { failed?: string[] } }).metadata.failed).toEqual(['bad']);
  });

  it('refuses an auto step on a manual run', async () => {
    setCard([makeRow('name', 'pre-1')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'manual' });
    await expect(fillStep(lead, 'run-1', 'pre-1')).rejects.toBeInstanceOf(FillRefused);
    expect(applyRow).not.toHaveBeenCalled();
  });
});

describe('manual mode', () => {
  it('Accept is a save: it needs the page saved, not submitted, then opens the next step', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('pan', 'pre-1'), makeRow('later', 'pre-4')]);
    const started = await startFill(lead, { changesetId: 'cs-1', mode: 'manual' });
    expect(started.view.status).toBe('waiting_user');
    expect(send).not.toHaveBeenCalled();
    // The page being typed carries the raw values.
    expect(started.view.steps[0]!.rows.map((r) => r.value)).toEqual(['value-name', 'value-pan']);

    await expect(acceptManualStep(lead, 'run-1', 'pre-1')).rejects.toThrow(/not saved yet/);
    // Saved as a draft: not complete, not submitted.
    checklist['pre-1'] = { responses: { name: 'value-name', pan: 'changed on the page' } };
    const view = await acceptManualStep(lead, 'run-1', 'pre-1');
    expect(rowOf('name').status).toBe('applied');
    expect(rowOf('pan')).toMatchObject({ status: 'skipped', error: 'Changed by you on the page.' });
    // pre-4 is not open (pre-1 was not submitted), and the page walk goes there anyway.
    expect(view.current).toBe('pre-4');
    expect(view.steps[1]).toMatchObject({ status: 'active', early: true });
    expect(submit).not.toHaveBeenCalled();
    expect(applyRow).not.toHaveBeenCalled();
  });

  it('counts a numeric-looking answer as saved when the page holds the same text', async () => {
    setCard([makeRow('capital', 'pre-1', { newValue: 1500000 })]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'manual' });
    checklist['pre-1'] = { responses: { capital: '1500000' } };
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

  it('marks a value copied early as "check" when another step now holds it differently', async () => {
    setCard([makeRow('later', 'pre-4')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'manual' });
    checklist['pre-4'] = { responses: { later: 'value-later' } };
    otherStep = { stepTitle: 'Client Details', value: 'renamed' };
    const view = await acceptManualStep(lead, 'run-1', 'pre-4');
    expect(view.steps[0]).toMatchObject({ early: true, checks: [{ label: 'later', message: expect.stringMatching(/Client Details.*check/i) }] });
  });
});

describe('summary', () => {
  const step = (stepId: string, title: string, filled: number, missing: string[] | null, extra: Record<string, unknown> = {}) => ({
    stepId,
    title,
    status: 'done' as const,
    filled,
    total: filled,
    rows: [],
    ...(missing ? { completeness: { complete: missing.length === 0, missing: missing.length, labels: missing } } : {}),
    ...extra,
  });

  it('counts values, steps, complete steps and what the rest still need', () => {
    const summary = fillSummary({
      companyName: 'Bonterra',
      status: 'done',
      steps: [
        step('pre-1', 'Client Details', 20, []),
        step('pre-4', 'Name approval', 10, ['SRN', 'Approval date', 'Approval letter', 'Expiry', 'Reference']),
        step('pre-6', 'Director KYC', 18, ['PAN copy']),
        step('pre-2', 'Board resolution', 0, null, { status: 'stopped', stopReason: '"Board resolution" needs the manager\'s approval, so I left it.' }),
      ],
    });
    expect(summary.line).toContain('Filled 48 values in 3 steps for Bonterra.');
    expect(summary.line).toContain('1 step complete, 2 need 6 more.');
    expect(summary.line).toContain("needs the manager's approval");
    expect(summary.needs).toEqual([
      { stepId: 'pre-4', title: 'Name approval', text: 'Needs SRN, Approval date, Approval letter and 2 more' },
      { stepId: 'pre-6', title: 'Director KYC', text: 'Needs PAN copy' },
    ]);
    expect(summary.openStepId).toBe('pre-4');
  });

  it('a whole fill reports the suggestions, the Ask-client list, what was left, the conflicts and the board resolution once', () => {
    const summary = fillSummary(
      { companyName: 'Bonterra', status: 'done', steps: [step('pre-1', 'Client Details', 9, ['Date of Board Resolution'])] },
      {
        ladder: {
          suggested: [{ stepId: 'pre-13', label: 'Number of equity shares' }],
          askClient: [{ stepId: 'pre-1', label: 'Date of Board Resolution' }, { stepId: 'pre-1', label: 'KYC of the person signing' }],
          left: [{ stepId: 'pre-1', label: 'Main NIC code', reason: 'The project lead fills this on the step page.' }],
          requestList: { id: 'list-1', href: '/app/lead/requests?list=list-1', items: 2 },
        },
        conflicts: 1,
        boardResolutionLine: 'Draft Board Resolution: not generated yet; it still needs Main NIC code.',
      },
    );
    expect(summary.line).toContain('Filled 9 values in 1 step for Bonterra.');
    expect(summary.line).toContain('1 answer was filled as suggested (Number of equity shares): check it.');
    expect(summary.line).toContain('Only the client can give 2 answers; I put them on one draft Ask-client list, not sent.');
    expect(summary.line).toContain('Left for the project lead: Main NIC code.');
    expect(summary.line).toContain('Documents differed on 1 answer');
    expect(summary.line).toContain('Draft Board Resolution: not generated yet');
  });

  it('the closing chat message carries the per-step list and an Open link', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('later', 'pre-4')]);
    checklist = { 'pre-1': { missing: ['PAN'] }, 'pre-4': { missing: ['SRN', 'Date'] } };
    await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    await fillStep(lead, 'run-1', 'pre-1');
    await fillStep(lead, 'run-1', 'pre-4');
    const { answer, text } = lastText();
    expect(text).toContain('0 steps complete, 2 need 3 more.');
    expect(answer.visual).toEqual({ type: 'keyFacts', facts: [expect.objectContaining({ v: 'Needs PAN' }), expect.objectContaining({ v: 'Needs SRN, Date' })] });
    expect(answer.links).toEqual([expect.objectContaining({ dest: { to: 'projectStep', engagementId: 'eng-1', stepId: 'pre-1' }, primary: true })]);
  });
});

describe('submit ready steps', () => {
  it('submits complete steps in order and stops at the first incomplete one, saying why', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('later', 'pre-4'), makeRow('last', 'pre-5')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    for (const id of ['pre-1', 'pre-4', 'pre-5']) await fillStep(lead, 'run-1', id);
    checklist = { ...checklist, 'pre-2': { complete: true }, 'pre-4': { missing: ['SRN'] } };
    const result = await submitReadySteps(lead, 'run-1');
    expect(submit.mock.calls.map((c) => c[2])).toEqual(['pre-1']);
    expect(result.submitted).toEqual(['Client Details']);
    expect(result.stopReason).toMatch(/still needs SRN, so I stopped there/);
    expect(result.line).toMatch(/^Submitted 1 step: Client Details\./);
  });

  it('stops at a step that needs the manager', async () => {
    setCard([makeRow('name', 'pre-1'), makeRow('draft', 'pre-2')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'auto' });
    await fillStep(lead, 'run-1', 'pre-1');
    const result = await submitReadySteps(lead, 'run-1');
    expect(submit.mock.calls.map((c) => c[2])).toEqual(['pre-1']);
    expect(result.stopReason).toMatch(/manager's approval/);
  });

  it('refuses while the fill is still going', async () => {
    setCard([makeRow('name', 'pre-1')]);
    await startFill(lead, { changesetId: 'cs-1', mode: 'manual' });
    await expect(submitReadySteps(lead, 'run-1')).rejects.toThrow(/still going/);
  });
});

describe('started line', () => {
  it('says Auto for a browser-driven Auto run and Manual for Manual', () => {
    const view = { companyName: 'Bonterra' };
    expect(fillStartedLine({ mode: 'manual', chip: 'auto', view })).toMatch(/\(Auto\) on screen/);
    expect(fillStartedLine({ mode: 'manual', view })).toMatch(/\(Manual\)/);
    expect(fillStartedLine({ mode: 'auto', view })).toMatch(/\(Auto\) in the background/);
  });

  it('keeps the chip on the run when it differs from the server mode', async () => {
    setCard([makeRow('name', 'pre-1')]);
    const started = await startFill(lead, { changesetId: 'cs-1', mode: 'manual', chip: 'auto' });
    expect(started.chip).toBe('auto');
    expect((run!.state as { chip?: string }).chip).toBe('auto');
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
