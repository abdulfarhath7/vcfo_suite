import { describe, expect, it } from 'vitest';
import { buildIncorporationModel } from '@/lib/client-portal/step-model';
import type { EngagementSchedule } from '@/lib/schedule-windows';
import { buildMasterPlan, buildTimelineBlocks, cascadeBlocks, isCriticalStep, projectedWindow, weekOf } from './master-plan';

const TODAY = '2026-10-28';
const win = (from: string, to: string) => ({ from, to, setBy: 'pm', setAt: '2026-09-01T00:00:00Z' });

/** Part A done, Part B open, one registration windowed, the rest without dates. */
const schedule: EngagementSchedule = {
  incorporation: win('2026-09-07', '2026-11-20'),
  steps: {
    'pre-1': win('2026-09-07', '2026-09-10'),
    'pre-2': win('2026-09-10', '2026-09-12'),
    'pre-3': win('2026-09-12', '2026-09-14'),
    'pre-4': win('2026-09-14', '2026-09-16'),
    'pre-5': win('2026-09-16', '2026-09-30'),
    'pre-13': win('2026-10-01', '2026-10-20'),
    'reg-4': win('2026-11-21', '2026-12-05'),
  },
};
const done = (completedOn: string) => ({ status: 'completed', completedOn });
const state = {
  'pre-1': done('2026-09-09'),
  'pre-2': done('2026-09-12'),
  'pre-3': done('2026-09-15'),
  'pre-4': done('2026-09-16'),
  'pre-5': done('2026-09-28'),
  'reg-13': { status: 'not-applicable' },
} as never;

describe('buildMasterPlan', () => {
  const model = buildIncorporationModel(state, schedule, TODAY);
  const plan = buildMasterPlan(model, TODAY);
  const row = (id: string) => plan.rows.find((r) => r.id === id)!;

  it('has one workstream per phase and a milestone only where a phase has dates', () => {
    expect(plan.workstreams.map((w) => w.no)).toEqual([1, 2, 3, 4]);
    expect(plan.workstreams[0]!.end).toBe('2026-09-30');
    expect(plan.milestones.map((m) => m.wsNo)).toEqual([1, 2, 4]);
    expect(plan.milestones.find((m) => m.wsNo === 4)!.date).toBe('2026-12-05');
    expect(plan.hasSchedule).toBe(true);
  });

  it('maps step states onto plan statuses, overdue when the window has passed', () => {
    expect(row('pre-1').status).toBe('done');
    expect(row('pre-1').actual).toBe('2026-09-09');
    expect(row('pre-1').schedule).toBe('On time');
    expect(row('pre-3').schedule).toBe('Delayed'); // done 15 Sep against a 14 Sep end
    expect(row('pre-13').status).toBe('over'); // open, window ended 20 Oct
    expect(row('pre-13').lateDays).toBeGreaterThan(0);
    expect(row('reg-13').status).toBe('na');
    expect(row('reg-4').status).toBe('todo');
    expect(row('reg-4').schedule).toBe('On track');
  });

  it('keeps steps without a window in the plan but gives them no dates', () => {
    const r = row('post-1');
    expect(r.start).toBeUndefined();
    expect(r.end).toBeUndefined();
    expect(r.days).toBeUndefined();
    expect(r.schedule).toBe('');
    expect(plan.workstreams[2]!.dated).toBe(0);
  });

  it('uses the expected COI as go-live and counts weeks from the first planned start', () => {
    expect(plan.start).toBe('2026-09-07');
    expect(plan.goLive).toBe('2026-11-20');
    expect(plan.goLiveFrom).toBe('coi');
    // the axis stretches to the last planned end when it is after go-live
    expect(plan.axisEnd).toBe('2026-12-05');
    expect(plan.weeks).toBe(weekOf('2026-09-07', '2026-12-05'));
    expect(weekOf('2026-09-07', '2026-09-07')).toBe(1);
    expect(weekOf('2026-09-07', '2026-09-14')).toBe(2);
  });

  it('marks the critical path: the current open step and the last window of its workstream', () => {
    // Part B: pre-13 is the open step (critical); the incorporation window end (20 Nov) is shared by the other Part B steps
    expect(row('pre-13').critical).toBe(true);
    expect(row('pre-12').critical).toBe(true); // its window ends on the phase end
    expect(row('pre-1').critical).toBe(false); // done steps are never critical
    expect(row('reg-13').critical).toBe(false); // N/A never critical
    expect(row('post-1').critical).toBe(false); // no dates in that workstream
    const p4 = model.phases[3]!;
    expect(isCriticalStep(model.byId['reg-4']!, p4)).toBe(true); // the only window in Registration
    expect(isCriticalStep(model.byId['reg-1']!, p4)).toBe(false);
  });

  it('falls back to the last planned end for go-live when there is no COI window', () => {
    const noCoi = buildIncorporationModel({}, { steps: { 'pre-1': win('2026-09-07', '2026-09-10') } }, TODAY);
    const p = buildMasterPlan(noCoi, TODAY);
    expect(p.goLive).toBe('2026-09-10');
    expect(p.goLiveFrom).toBe('plan');
    const empty = buildMasterPlan(buildIncorporationModel({}, null, TODAY), TODAY);
    expect(empty.hasSchedule).toBe(false);
    expect(empty.weeks).toBe(0);
    expect(empty.goLiveFrom).toBe('none');
  });
});

describe('timeline change blocks', () => {
  it('derives the four blocks and cascades a later block when an earlier one grows', () => {
    const model = buildIncorporationModel(state, schedule, TODAY);
    const blocks = buildTimelineBlocks(model)!;
    expect(blocks.map((b) => b.id)).toEqual(['p1', 'p2', 'mca', 'coi']);
    expect(blocks[0]!.done).toBe(true);
    expect(blocks[3]!.from).toBe('2026-11-20');
    // push Phase 2's end past the MCA block: MCA and COI move, COI stays a single day
    const moved = cascadeBlocks(blocks, 1, blocks[1]!.from, '2026-11-25');
    expect(moved[1]!.to).toBe('2026-11-25');
    expect(moved[2]!.from).toBe('2026-11-25');
    expect(moved[3]!.from).toBe(moved[3]!.to);
    expect(moved[3]!.from >= moved[2]!.to).toBe(true);
    // a done block never moves
    const locked = cascadeBlocks(blocks, 0, '2026-01-01', '2026-01-02');
    expect(locked[0]!.from).toBe(blocks[0]!.from);
  });

  it('returns null without any COI date', () => {
    expect(buildTimelineBlocks(buildIncorporationModel({}, null, TODAY))).toBeNull();
  });
});

/* Owner, 2026-10-29: with no dates set by SBC the master calendar still shows the plan, projected from the playbook. */
describe('projected plan (no manager dates)', () => {
  it('projects estimated weeks from the start and statutory limits from incorporation', () => {
    expect(projectedWindow({ kind: 'estimated-weeks', weeks: [2, 3] }, '2026-10-01', undefined)).toEqual(['2026-10-08', '2026-10-21']);
    expect(projectedWindow({ kind: 'days-from-incorporation', days: 30 }, '2026-10-01', '2026-12-31')).toEqual(['2026-12-31', '2027-01-30']);
    expect(projectedWindow({ kind: 'fixed-window-weeks', weeks: 2 }, '2026-10-01', '2026-12-31')).toEqual(['2026-12-31', '2027-01-14']);
    expect(projectedWindow({ kind: 'days-from-incorporation', days: 30 }, '2026-10-01', undefined)).toBeUndefined();
    expect(projectedWindow({ kind: 'no-statutory-limit' }, '2026-10-01', '2026-12-31')).toBeUndefined();
  });

  it('marks every projected bar, gives no on-time verdict, and leaves no-limit steps undated', () => {
    const model = buildIncorporationModel({} as never, null, '2026-10-29');
    const plan = buildMasterPlan(model, '2026-10-29', { start: '2026-10-01' });
    expect(plan.hasSchedule).toBe(false);
    expect(plan.projected).toBe(true);
    const dated = plan.rows.filter((r) => r.start && r.end);
    expect(dated.length).toBeGreaterThan(10);
    expect(dated.every((r) => r.projected && r.schedule === '')).toBe(true);
    expect(plan.rows.some((r) => !r.start)).toBe(true);
    // without a projection start nothing is invented
    expect(buildMasterPlan(model, '2026-10-29').projected).toBe(false);
  });
});
