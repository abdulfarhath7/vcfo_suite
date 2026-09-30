import { describe, expect, it } from 'vitest';
import { getIncorporationPhases } from '@/data/checklist';
import { buildPhaseProgress, PHASE_BY_ID } from '@/lib/ask/phase-progress';
import { phaseProgressAnswer } from '@/lib/ask/suggestions';
import { CLIENT_TOOLS, type ClientToolContext } from '@/lib/ask/tools/client';
import { phaseProgressFor, STAFF_TOOLS, type StaffData } from '@/lib/ask/tools/staff';
import type { Engagement } from '@/data/engagements';
import { checkDestination } from '@/lib/ask/destinations';
import { SNAPSHOTS } from '../../../../tests/ask/evals/golden';

const phases = getIncorporationPhases();
const partA = phases[0]!;
const partB = phases[1]!;
type State = Parameters<typeof buildPhaseProgress>[0]['state'];
const done = (ids: readonly string[], status = 'completed'): State =>
  Object.fromEntries(ids.map((id) => [id, { status, completedOn: '2026-09-01' }])) as State;

describe('buildPhaseProgress', () => {
  it('fresh engagement: Part A current, the rest upcoming, counts match active items', () => {
    const rows = buildPhaseProgress({ state: {} });
    expect(rows.map((r) => r.state)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
    expect(rows.map((r) => r.total)).toEqual(phases.map((p) => p.items.length));
    expect(rows.every((r) => r.done === 0)).toBe(true);
    expect(rows[0]!.currentStep).toMatchObject({ id: partA.itemIds[0], locked: false });
  });

  it('Part A all terminal with the current step in Part B: A done, B current', () => {
    const rows = buildPhaseProgress({ state: done(partA.itemIds) });
    expect(rows[0]).toMatchObject({ state: 'done', done: partA.items.length });
    expect(rows[1]).toMatchObject({ state: 'current', done: 0 });
    expect(rows[1]!.currentStep?.id).toBe(partB.itemIds[0]);
    expect(rows[0]!.currentStep).toBeUndefined();
  });

  it('counts not-applicable as done', () => {
    const state = { ...done([partA.itemIds[0]!]), ...done([partA.itemIds[1]!, partA.itemIds[2]!], 'not-applicable') };
    const rows = buildPhaseProgress({ state });
    expect(rows[0]!.done).toBe(3);
    expect(rows[0]!.currentStep?.id).toBe(partA.itemIds[3]);
  });

  it('follows each phase itemIds order and never includes legacy rows', () => {
    const rows = buildPhaseProgress({ state: {} });
    expect(rows.map((r) => r.id)).toEqual(phases.map((p) => p.id));
    expect(rows.map((r) => r.name)).toEqual(phases.map((p) => PHASE_BY_ID[p.id]));
    const json = JSON.stringify(buildPhaseProgress({ state: done(phases.flatMap((p) => p.itemIds)) }));
    for (const legacy of ['reg-2', 'pre-6', 'pre-8']) expect(json).not.toContain(`"${legacy}"`);
    // Part B starts at Capital Structure (pre-13), not the lowest `order`.
    expect(partB.itemIds[0]).toBe('pre-13');
  });

  it('everything complete: every phase done, no current step', () => {
    const rows = buildPhaseProgress({ state: done(phases.flatMap((p) => p.itemIds)) });
    expect(rows.every((r) => r.state === 'done' && !r.currentStep)).toBe(true);
  });

  it('carries only ids, names and counts — no people, dates or documents', () => {
    const state = {
      'pre-1': { status: 'completed', completedOn: '2026-09-01', responses: { pan: 'ABCDE1234F', signatoryFirstName: 'Priya' } },
    } as never;
    const json = JSON.stringify(buildPhaseProgress({ state }));
    for (const secret of ['ABCDE1234F', 'Priya', '2026-09-01']) expect(json).not.toContain(secret);
  });

  it('an LLP or partnership follows the same active catalog and phase names', () => {
    // The catalog and its phase names do not vary by legal form today; this pins that the
    // rows come from `getIncorporationPhases()` and nothing is invented per form.
    expect(buildPhaseProgress({ state: {} }).map((r) => r.name)).toEqual([
      'SPICe+ Part A',
      'SPICe+ Part B',
      'Post-incorporation',
      'Registration',
    ]);
  });
});

describe('getPhaseProgress tools', () => {
  const clientCtx: ClientToolContext = {
    snapshot: SNAPSHOTS.foreignCompany,
    state: done(partA.itemIds),
    filings: [],
    now: new Date('2026-10-01T00:00:00Z'),
  };

  it('client tool reads only its own engagement context, whatever input it is handed', async () => {
    const tool = CLIENT_TOOLS.getPhaseProgress!;
    expect(tool.definition.strict).toBe(true);
    expect(tool.definition.input_schema).toMatchObject({ properties: {}, additionalProperties: false });
    const own = await tool.run(clientCtx, {});
    const withForeignId = await tool.run(clientCtx, { engagementId: 'someone-else' });
    expect(withForeignId).toEqual(own);
    expect((own as Array<{ state: string }>)[1]!.state).toBe('current');
  });

  const eng = (id: string): StaffData['engagements'][number] => ({
    dbId: `db-${id}`,
    engagement: { id, slug: id, companyName: `Company ${id}`, stage: 'Pre-Incorporation', health: 'on-track' } as Engagement,
    state: {},
  });
  const data: StaffData = { engagements: [eng('acme')], filings: [], now: new Date('2026-10-01T00:00:00Z') };

  it('staff tool returns rows for an engagement in scope', async () => {
    const out = (await STAFF_TOOLS.getPhaseProgress!.run(data, { engagementId: 'acme' })) as { phases: unknown[]; company: string };
    expect(out.company).toBe('Company acme');
    expect(out.phases).toHaveLength(4);
    expect(STAFF_TOOLS.getPhaseProgress!.definition.input_schema).toMatchObject({ required: ['engagementId'], additionalProperties: false });
  });

  it('staff tool rejects an engagement outside the caller scope', () => {
    expect(phaseProgressFor(data, 'not-mine')).toEqual({ error: 'not_in_scope' });
    expect(phaseProgressFor(data, '')).toEqual({ error: 'not_in_scope' });
  });
});

describe('phaseProgressAnswer', () => {
  it('client-owned open step: line, flow, and both links with the primary focusing the step', () => {
    const rows = buildPhaseProgress({ state: {} });
    const step = rows[0]!.currentStep!;
    const answer = phaseProgressAnswer(SNAPSHOTS.domesticCompany, rows);
    expect(answer.origin).toBe('deterministic');
    expect(answer.line).toBe(`0 of ${rows.reduce((n, r) => n + r.total, 0)} steps are complete. You're in SPICe+ Part A, on ${step.title}.`);
    expect(answer.visual).toMatchObject({ type: 'flow' });
    expect(answer.visual?.type === 'flow' && answer.visual.stages.map((s) => s.state)).toEqual(['here', 'next', 'next', 'next']);
    expect(answer.citations).toEqual([{ id: 'getPhaseProgress', label: 'Your project' }]);
    expect(answer.links?.[0]).toEqual({ dest: { to: 'incorporation', focusStepId: step.id }, label: 'Open Incorporation', primary: true });
    expect(answer.links?.[1]?.dest).toMatchObject({ to: 'step', stepId: step.id, section: 'upload' });
    for (const link of answer.links ?? []) expect(checkDestination(link.dest, { shell: 'client' })).not.toBeNull();
  });

  it('no second link when the current step is lead-owned', () => {
    // pre-1 done → the current step is pre-2 (Draft Board Resolution), owned by the lead.
    const rows = buildPhaseProgress({ state: done([partA.itemIds[0]!]) });
    expect(rows[0]!.currentStep?.owner).toBe('lead');
    const answer = phaseProgressAnswer(SNAPSHOTS.foreignCompany, rows);
    expect(answer.links).toHaveLength(1);
    expect(answer.links?.[0]?.dest.to).toBe('incorporation');
  });

  it('no second link when the current step is locked', () => {
    const rows = buildPhaseProgress({ state: {} }).map((r) =>
      r.currentStep ? { ...r, currentStep: { ...r.currentStep, locked: true } } : r,
    );
    expect(phaseProgressAnswer(SNAPSHOTS.foreignCompany, rows).links).toHaveLength(1);
  });

  it('all complete: fixed line and no links', () => {
    const rows = buildPhaseProgress({ state: done(phases.flatMap((p) => p.itemIds)) });
    const answer = phaseProgressAnswer(SNAPSHOTS.foreignCompany, rows);
    expect(answer.line).toBe('All incorporation steps are complete.');
    expect(answer.links).toBeUndefined();
  });
});
