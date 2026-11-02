/**
 * Master calendar (client portal, Oct 2026) — the engagement's incorporation
 * plan as a project plan. Pure: built from the step model
 * (src/lib/client-portal/step-model.ts) and "today".
 *
 * The prototype read a project-plan spreadsheet. Our tool has no such plan, so
 * the plan is the engagement's own checklist and the windows SBC set on it:
 *
 *   workstream   = a phase (SPICe+ Part A, Part B, Post-incorporation, Registration)
 *   deliverable  = a step
 *   planned      = the step's manager window (windowFrom → due)
 *   actual       = the day the step was done
 *   status       = done → Completed · client / SBC / MCA working → WIP ·
 *                  not started → Yet to begin · past its window and not done → Overdue ·
 *                  not applicable → NA
 *   side         = who holds it: the client, SBC or MCA
 *   milestone    = each workstream's last planned end
 *   go-live      = the expected COI (incorporation window end), else the last planned end
 *
 * Critical path (a real, simple rule — documented here and tested):
 *   a deliverable is critical when a slip on it moves its workstream's milestone,
 *   which is true for
 *     (a) any step whose planned end IS the workstream's planned end (the last
 *         window in the phase — ties included), and
 *     (b) the step that is open right now in a workstream that has dates: the
 *         gate opens one step at a time, so while this one is not done every
 *         step after it waits, and the milestone waits with them.
 *   Done and not-applicable steps are never critical.
 *
 * A step with no window keeps its row (the table says "no planned dates"); it
 * gets no bar, no schedule word and no week numbers — we never invent dates.
 */
import type { DeadlineRule } from '@/lib/projects/deadlines';
import type { PortalIncorporationModel, PortalPhase, PortalStep } from './step-model';

export type PlanStatus = 'done' | 'wip' | 'todo' | 'over' | 'na';
export type PlanSide = 'client' | 'sbc' | 'mca';
export type PlanSchedule = 'On time' | 'Delayed' | 'At risk' | 'On track' | '';

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  done: 'Completed',
  wip: 'WIP',
  todo: 'Yet to begin',
  over: 'Overdue',
  na: 'Not applicable',
};

/** Prototype MCS colours (CSS variables from the portal sheet). */
export const PLAN_STATUS_COLOR: Record<PlanStatus, string> = {
  done: 'var(--mc-done)',
  wip: 'var(--mc-wip)',
  todo: 'var(--mc-todo)',
  over: 'var(--mc-over)',
  na: 'var(--mc-na)',
};

export interface PlanRow {
  id: string;
  /** 1-based step number across the checklist. */
  n: number;
  title: string;
  /** Workstream (phase) number 1–4 and name. */
  wsNo: number;
  ws: string;
  /** Planned window (ISO days). Both or neither. */
  start?: string;
  end?: string;
  /** Calendar days in the window, inclusive. */
  days?: number;
  /** Day the step was done. */
  actual?: string;
  status: PlanStatus;
  /** The portal's finer state, for the card ("Waiting on you", "With SBC" …). */
  raw: string;
  side: PlanSide;
  critical: boolean;
  schedule: PlanSchedule;
  /** The workstream's milestone this step feeds. */
  milestone: string;
  /** Title of the step right before it in the same workstream (the gate dependency). */
  dependsOn?: string;
  /** Days late when overdue. */
  lateDays: number;
  /**
   * The window is projected from SBC's playbook (the step's deadline rule), not
   * set by the manager: shown while the project has no planned dates at all.
   */
  projected?: boolean;
}

export interface PlanWorkstream {
  no: number;
  name: string;
  rows: PlanRow[];
  start?: string;
  end?: string;
  /** How many rows have a window. */
  dated: number;
}

export interface PlanMilestone {
  wsNo: number;
  name: string;
  /** The workstream's last planned end. */
  date: string;
  done: number;
  total: number;
}

export interface MasterPlan {
  rows: PlanRow[];
  workstreams: PlanWorkstream[];
  milestones: PlanMilestone[];
  /** First planned start across the plan. */
  start?: string;
  /** Go-live: expected COI, else the last planned end. */
  goLive?: string;
  /** Source of the go-live date. */
  goLiveFrom: 'coi' | 'plan' | 'none';
  /** The plan's last day on the week axis: max(goLive, last planned end). */
  axisEnd?: string;
  /** Number of week columns from `start` to `axisEnd` (0 without dates). */
  weeks: number;
  /** Any step with a manager-set window at all. */
  hasSchedule: boolean;
  /**
   * No manager-set windows, so the bars are projected from SBC's playbook
   * (`projectedWindow`): estimated weeks from the project start for SPICe+,
   * days from incorporation for the steps with a statutory limit.
   */
  projected: boolean;
  counts: Record<PlanStatus, number>;
}

/** What a projection needs: the project start and, once known, the incorporation date. */
export interface PlanProjection {
  /** The project's start (its creation date, or the first step done if earlier). */
  start: string;
  incorporationDate?: string | null;
}

/**
 * A step's window projected from its deadline rule (src/lib/deadlines.ts), used
 * only while the manager has set no dates:
 *   estimated-weeks [a, b]      → week a to week b from the project start
 *   days-from-incorporation n   → from incorporation to n days after it
 *   fixed-window-weeks w        → from incorporation to w weeks after it
 *   no-statutory-limit / other  → no window (the row says "no planned dates")
 */
export function projectedWindow(rule: DeadlineRule, base: string, coi: string | undefined): [string, string] | undefined {
  switch (rule.kind) {
    case 'estimated-weeks':
      return [addPlanDays(base, (rule.weeks[0] - 1) * 7), addPlanDays(base, rule.weeks[1] * 7 - 1)];
    case 'days-from-incorporation':
      return coi ? [coi, addPlanDays(coi, rule.days)] : undefined;
    case 'fixed-window-weeks':
      return coi ? [coi, addPlanDays(coi, rule.weeks * 7)] : undefined;
    default:
      return undefined;
  }
}

const DAY_MS = 86_400_000;
const P = (s: string): number => Date.parse(`${s.slice(0, 10)}T00:00:00Z`);

export function planDaysBetween(a: string, b: string): number {
  return Math.round((P(b) - P(a)) / DAY_MS);
}

/** 1-based week of `iso` counted from `start` (W1 holds `start`). */
export function weekOf(start: string, iso: string): number {
  return Math.floor(planDaysBetween(start, iso) / 7) + 1;
}

export function addPlanDays(iso: string, n: number): string {
  return new Date(P(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Workstream names (prototype PHASE_NAMES). */
export const WORKSTREAM_NAMES = ['SPICe+ Part A', 'SPICe+ Part B', 'Post-incorporation', 'Registration'];

/** Milestone each workstream delivers. */
export const MILESTONE_NAMES = ['Name reserved', 'Incorporation filed', 'Company operational', 'Registrations complete'];

function statusOf(s: PortalStep, today: string): PlanStatus {
  const na = (s.slice?.status as string | undefined) === 'not-applicable';
  if (na) return 'na';
  if (s.kind === 'done') return 'done';
  const working = s.kind === 'you' || s.kind === 'prog' || s.kind === 'with';
  if (s.late || (s.due && s.due < today)) return 'over';
  return working ? 'wip' : 'todo';
}

function scheduleOf(status: PlanStatus, end: string | undefined, actual: string | undefined, today: string): PlanSchedule {
  if (status === 'na' || !end) return '';
  if (status === 'done') return actual ? (actual > end ? 'Delayed' : 'On time') : '';
  if (end < today) return 'Delayed';
  return planDaysBetween(today, end) <= 7 ? 'At risk' : 'On track';
}

function rawOf(s: PortalStep, status: PlanStatus): string {
  if (status === 'na') return 'Not applicable';
  if (status === 'done') return 'Done';
  if (s.kind === 'you') return 'Waiting on you';
  if (s.kind === 'prog') return 'You are working on it';
  if (s.kind === 'with') return s.owner === 'mca' ? 'With MCA' : 'With SBC';
  if (s.kind === 'next') return 'Next';
  return 'Yet to start';
}

function phaseEnd(p: PortalPhase): string | undefined {
  const ends = p.steps.filter((s) => (s.slice?.status as string | undefined) !== 'not-applicable').map((s) => s.due).filter((d): d is string => Boolean(d));
  return ends.sort().at(-1);
}

/**
 * Critical path, as documented in the header: the last window(s) of the
 * workstream, plus the step currently open in a dated workstream.
 */
export function isCriticalStep(step: PortalStep, phase: PortalPhase): boolean {
  if (step.kind === 'done' || (step.slice?.status as string | undefined) === 'not-applicable') return false;
  const end = phaseEnd(phase);
  if (!end) return false;
  if (step.due === end) return true;
  const current = phase.steps.find((s) => s.kind === 'you' || s.kind === 'prog' || s.kind === 'with');
  return current?.id === step.id;
}

export function buildMasterPlan(model: PortalIncorporationModel, today: string, projection?: PlanProjection): MasterPlan {
  const rows: PlanRow[] = [];
  const workstreams: PlanWorkstream[] = [];
  const milestones: PlanMilestone[] = [];
  const counts: Record<PlanStatus, number> = { done: 0, wip: 0, todo: 0, over: 0, na: 0 };

  // project from the playbook only when the manager has set no window at all
  const managerDated = model.steps.some((s) => s.windowFrom && s.due);
  let base: string | undefined;
  let coi: string | undefined;
  if (!managerDated && projection) {
    const firstDone = model.steps.map((s) => s.doneOn).filter((d): d is string => Boolean(d)).sort()[0];
    base = firstDone && firstDone < projection.start.slice(0, 10) ? firstDone : projection.start.slice(0, 10);
    const coiStep = model.byId['pre-12'];
    coi =
      projection.incorporationDate?.slice(0, 10) ||
      (coiStep?.kind === 'done' ? coiStep.doneOn : undefined) ||
      (coiStep ? projectedWindow(coiStep.item.deadline, base, undefined)?.[1] : undefined);
  }

  model.phases.forEach((p, i) => {
    const wsName = WORKSTREAM_NAMES[i] ?? p.name;
    const msName = MILESTONE_NAMES[i] ?? p.name;
    const wsRows: PlanRow[] = [];
    let prev: PortalStep | undefined;
    for (const s of p.steps) {
      const status = statusOf(s, today);
      const na = status === 'na';
      const proj = base && !na ? projectedWindow(s.item.deadline, base, coi) : undefined;
      const start = s.windowFrom && s.due ? s.windowFrom : proj?.[0];
      const end = s.windowFrom && s.due ? s.due : proj?.[1];
      const projected = Boolean(proj) && !(s.windowFrom && s.due);
      const actual = s.kind === 'done' ? s.doneOn : undefined;
      const row: PlanRow = {
        id: s.id,
        n: s.n,
        title: s.title,
        wsNo: i + 1,
        ws: wsName,
        start,
        end,
        days: start && end ? planDaysBetween(start, end) + 1 : undefined,
        actual,
        status,
        raw: rawOf(s, status),
        side: s.owner,
        critical: isCriticalStep(s, p),
        // an estimate is not a commitment: no on-time / delayed verdict against a projected window
        schedule: projected ? '' : scheduleOf(status, end, actual, today),
        milestone: msName,
        dependsOn: prev?.title,
        lateDays: status === 'over' ? (s.lateDays || (s.due ? Math.max(1, planDaysBetween(s.due, today)) : 0)) : 0,
        projected: projected || undefined,
      };
      counts[status] += 1;
      wsRows.push(row);
      rows.push(row);
      prev = s;
    }
    const starts = wsRows.map((r) => r.start).filter((d): d is string => Boolean(d)).sort();
    const ends = wsRows.map((r) => r.end).filter((d): d is string => Boolean(d)).sort();
    const ws: PlanWorkstream = { no: i + 1, name: wsName, rows: wsRows, start: starts[0], end: ends.at(-1), dated: ends.length };
    workstreams.push(ws);
    if (ws.end) {
      const app = wsRows.filter((r) => r.status !== 'na');
      milestones.push({ wsNo: i + 1, name: msName, date: ws.end, done: app.filter((r) => r.status === 'done').length, total: app.length });
    }
  });

  const allStarts = rows.map((r) => r.start).filter((d): d is string => Boolean(d)).sort();
  const allEnds = rows.map((r) => r.end).filter((d): d is string => Boolean(d)).sort();
  const start = allStarts[0];
  const lastEnd = allEnds.at(-1);
  const goLive = model.coiExpected ?? lastEnd;
  const goLiveFrom: MasterPlan['goLiveFrom'] = model.coiExpected ? 'coi' : lastEnd ? 'plan' : 'none';
  const axisEnd = goLive && lastEnd ? (goLive > lastEnd ? goLive : lastEnd) : goLive ?? lastEnd;
  const weeks = start && axisEnd ? Math.max(1, weekOf(start, axisEnd)) : 0;
  const projectedRows = rows.some((r) => r.projected);

  return {
    rows,
    workstreams,
    milestones,
    start,
    goLive,
    goLiveFrom,
    axisEnd,
    weeks,
    hasSchedule: managerDated,
    projected: !managerDated && projectedRows,
    counts,
  };
}

/* ---------------------------------------------------------------- timeline change request */

/**
 * The four blocks a client may ask to move (the timeline change request the
 * manager approves): Phase 1, Phase 2 (without MCA / COI), the MCA review and
 * the COI day. Copied from the previous portal's derive.ts `buildTimeline`
 * so the request keeps the shape `/api/client/change-requests` (kind
 * 'timeline') and the manager's approval expect.
 */
export interface TimelineBlock {
  id: 'p1' | 'p2' | 'mca' | 'coi';
  name: string;
  from: string;
  to: string;
  done: boolean;
  milestone?: boolean;
}

function spanOf(steps: PortalStep[]): { from?: string; to?: string; done: boolean } {
  const starts: string[] = [];
  const ends: string[] = [];
  for (const s of steps) {
    const a = s.windowFrom ?? s.doneOn;
    const b = s.kind === 'done' ? s.doneOn ?? s.due : s.due;
    if (a) starts.push(a);
    if (b) ends.push(b);
  }
  starts.sort();
  ends.sort();
  return { from: starts[0], to: ends.at(-1), done: steps.length > 0 && steps.every((s) => s.kind === 'done') };
}

export function buildTimelineBlocks(model: PortalIncorporationModel, incorporationDate?: string | null): TimelineBlock[] | null {
  const p1 = model.phases[0];
  const p2 = model.phases[1];
  if (!p1 || !p2) return null;
  const a = spanOf(p1.steps);
  const b = spanOf(p2.steps.filter((s) => s.id !== 'pre-11' && s.id !== 'pre-12'));
  const mcaStep = model.byId['pre-11'];
  const coiStep = model.byId['pre-12'];
  const inc = incorporationDate ? incorporationDate.slice(0, 10) : undefined;
  const coi = inc ?? (coiStep?.kind === 'done' ? coiStep.doneOn : undefined) ?? model.coiExpected ?? coiStep?.due;
  if (!coi) return null;
  const aFrom = a.from ?? b.from;
  if (!aFrom) return null;
  const aTo = a.to && a.to >= aFrom ? a.to : aFrom;
  const bFrom = a.done ? aTo : b.from && b.from >= aTo ? b.from : aTo;
  let bTo = b.to && b.to >= bFrom ? b.to : bFrom;
  if (bTo > coi) bTo = coi;
  const mcaOwn = mcaStep?.windowFrom && mcaStep.due !== model.coiExpected ? { from: mcaStep.windowFrom, to: mcaStep.kind === 'done' ? mcaStep.doneOn ?? mcaStep.due : mcaStep.due } : undefined;
  const mFrom = mcaOwn?.from && mcaOwn.from >= bTo ? mcaOwn.from : bTo;
  const mTo = mcaOwn?.to && mcaOwn.to >= mFrom && mcaOwn.to <= coi ? mcaOwn.to : coi;
  return [
    { id: 'p1', name: `Phase 1 · ${p1.name}`, from: aFrom, to: aTo, done: a.done },
    { id: 'p2', name: `Phase 2 · ${p2.name}`, from: bFrom, to: bTo, done: b.done },
    { id: 'mca', name: 'MCA review', from: mFrom, to: mTo, done: mcaStep?.kind === 'done' },
    { id: 'coi', name: 'COI', from: coi, to: coi, done: coiStep?.kind === 'done' || Boolean(inc), milestone: true },
  ];
}

/**
 * Cascade after one block is edited (the previous editor's rule): a block never
 * starts before the one before it ends; a later block that would now overlap is
 * pushed, keeping its length; a milestone (COI) has no length. Done blocks are
 * never moved by the client.
 */
export function cascadeBlocks(blocks: TimelineBlock[], index: number, from: string, to: string): TimelineBlock[] {
  const out = blocks.map((b) => ({ ...b }));
  const b = out[index];
  if (!b || b.done) return out;
  const minFrom = index > 0 ? out[index - 1]!.to : from;
  let nf = from < minFrom ? minFrom : from;
  let nt = b.milestone ? nf : to < nf ? nf : to;
  b.from = nf;
  b.to = nt;
  for (let j = index + 1; j < out.length; j++) {
    const q = out[j]!;
    const prev = out[j - 1]!;
    if (q.from < prev.to) {
      const len = planDaysBetween(q.from, q.to);
      nf = prev.to;
      nt = q.milestone ? nf : addPlanDays(nf, len);
      q.from = nf;
      q.to = nt;
    }
  }
  return out;
}
