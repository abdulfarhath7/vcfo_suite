import { getPreIncPhases } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import {
  gateActiveCatalog,
  getStepGate,
  type ChecklistGateViewer,
  type ChecklistStepGateKind,
} from '@/lib/checklist-step-gate';
import { windowForStep, type EngagementSchedule } from '@/lib/schedule-windows';

/**
 * Client home timeline — the prototype's four-bar chart
 * (name, incorporation, MCA review, certificate), fed by live steps.
 *
 * Dates come only from a completion day or a manager-set window.
 * A step with neither is "Not set". It is never given a made-up calendar day.
 * When name and incorporation share the one incorporation window, that window
 * is split by how many steps each phase holds, and the bar is marked shared.
 */

const DAY = 86_400_000;
const MCA_ID = 'pre-11';
const COI_ID = 'pre-12';

const DAY_MONTH = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export type TimelineTone = 'done' | 'current' | 'waiting' | 'upcoming';

export interface TimelineInputStep {
  id: string;
  title: string;
  kind: ChecklistStepGateKind;
  completedOn?: string;
}

export interface TimelineStepView {
  id: string;
  title: string;
  tone: TimelineTone;
  dateLabel: string;
}

export interface TimelineBarView {
  id: string;
  label: string;
  tone: TimelineTone;
  locked: boolean;
  milestone: boolean;
  /** True when the bar is a slice of the shared incorporation window. */
  sharedWindow: boolean;
  left: number;
  width: number;
  from: string | null;
  to: string | null;
  rangeLabel: string;
  steps: TimelineStepView[];
  startDay: number;
  endDay: number;
}

export interface TimelineModel {
  axisStart: string;
  axisEnd: string;
  spanDays: number;
  ticks: { label: string; left: number }[];
  todayLeft: number | null;
  /** ISO calendar date the model was built for. */
  today: string;
  todayLabel: string;
  bars: TimelineBarView[];
  headline: string;
  /** Shown under the chart when the two SPICe phases share one window. */
  sharedNote: string | null;
}

export interface PhaseSpan {
  start: number;
  end: number;
  locked: boolean;
  milestone: boolean;
}

interface StationDraft {
  id: string;
  label: string;
  milestone: boolean;
  steps: TimelineInputStep[];
}

function utcDay(value: string | Date): number {
  if (value instanceof Date) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  const iso = value.slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return NaN;
  return parsed.getTime();
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(ms: number, days: number): number {
  return ms + days * DAY;
}

function daySpan(fromMs: number, toMs: number): number {
  return Math.max(0, Math.round((toMs - fromMs) / DAY));
}

function toneOf(kind: ChecklistStepGateKind): TimelineTone {
  if (kind === 'done') return 'done';
  if (kind === 'active') return 'waiting';
  if (kind === 'waiting') return 'current';
  return 'upcoming';
}

function statusWord(tone: TimelineTone): string {
  if (tone === 'done') return 'Completed';
  if (tone === 'waiting') return 'Waiting for you';
  if (tone === 'current') return 'In progress';
  return 'Upcoming';
}

function formatDay(ms: number): string {
  return DAY_MONTH.format(new Date(ms));
}

function formatRange(fromMs: number, toMs: number, milestone: boolean): string {
  if (milestone || fromMs === toMs) return formatDay(fromMs);
  return `${formatDay(fromMs)} – ${formatDay(toMs)}`;
}

function stationsFrom(steps: TimelineInputStep[]): StationDraft[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const phases = getPreIncPhases();
  const phase1 = phases.find((phase) => phase.id === 'pre-inc-phase-1');
  const phase2 = phases.find((phase) => phase.id === 'pre-inc-phase-2');
  const pick = (ids: string[]): TimelineInputStep[] =>
    ids.map((id) => byId.get(id)).filter((step): step is TimelineInputStep => Boolean(step));

  const phase2Ids = (phase2?.itemIds ?? []).filter((id) => id !== MCA_ID && id !== COI_ID);
  return [
    {
      id: 'name',
      label: 'Phase 1 · Name Application',
      milestone: false,
      steps: pick(phase1?.itemIds ?? []),
    },
    {
      id: 'incorporation',
      label: 'Phase 2 · Incorporation',
      milestone: false,
      steps: pick(phase2Ids),
    },
    {
      id: 'mca',
      label: 'MCA review',
      milestone: false,
      steps: pick([MCA_ID]),
    },
    {
      id: 'coi',
      label: 'COI',
      milestone: true,
      steps: pick([COI_ID]),
    },
  ];
}

function stepInterval(
  step: TimelineInputStep,
  schedule: EngagementSchedule | null | undefined,
): { from: number; to: number } | null {
  if (step.kind === 'done' && step.completedOn) {
    const day = utcDay(step.completedOn);
    if (!Number.isNaN(day)) return { from: day, to: day };
  }
  const window = windowForStep(schedule, step.id);
  if (!window) return null;
  const from = utcDay(window.from);
  const to = utcDay(window.to);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return { from, to };
}

function stationTone(steps: TimelineInputStep[]): TimelineTone {
  if (steps.length > 0 && steps.every((step) => step.kind === 'done')) return 'done';
  if (steps.some((step) => step.kind === 'active')) return 'waiting';
  if (steps.some((step) => step.kind === 'waiting' || step.kind === 'done')) return 'current';
  return 'upcoming';
}

function sharesIncorporationWindow(
  schedule: EngagementSchedule | null | undefined,
  nameSteps: TimelineInputStep[],
  incSteps: TimelineInputStep[],
): boolean {
  const window = schedule?.incorporation;
  if (!window) return false;
  const own = schedule.steps ?? {};
  const covered = [...nameSteps, ...incSteps];
  if (covered.length === 0) return false;
  return covered.every((step) => !own[step.id] && windowForStep(schedule, step.id)?.from === window.from);
}

export function buildClientTimeline(input: {
  steps: TimelineInputStep[];
  schedule?: EngagementSchedule | null;
  startDate?: string | null;
  now?: Date;
}): TimelineModel {
  const nowMs = utcDay(input.now ?? new Date());
  const stations = stationsFrom(input.steps);
  const schedule = input.schedule ?? null;
  const shared =
    sharesIncorporationWindow(schedule, stations[0]?.steps ?? [], stations[1]?.steps ?? []) &&
    Boolean(schedule?.incorporation);

  const sharedWindow = schedule?.incorporation;
  const sharedFrom = sharedWindow ? utcDay(sharedWindow.from) : NaN;
  const sharedTo = sharedWindow ? utcDay(sharedWindow.to) : NaN;
  const nameCount = Math.max(1, stations[0]?.steps.length ?? 1);
  const incCount = Math.max(1, stations[1]?.steps.length ?? 1);
  let sharedSplit: { name: { from: number; to: number }; inc: { from: number; to: number } } | null =
    null;
  if (shared && !Number.isNaN(sharedFrom) && !Number.isNaN(sharedTo)) {
    const span = Math.max(1, daySpan(sharedFrom, sharedTo));
    const nameDays = Math.min(span - 1, Math.max(1, Math.round((span * nameCount) / (nameCount + incCount))));
    const nameTo = addDays(sharedFrom, nameDays);
    sharedSplit = {
      name: { from: sharedFrom, to: nameTo },
      inc: { from: nameTo, to: sharedTo },
    };
  }

  type Placed = {
    station: StationDraft;
    tone: TimelineTone;
    from: number | null;
    to: number | null;
    sharedWindow: boolean;
    /** Still open, so the bar is drawn through today rather than stopping at the last finished step. */
    openEnded: boolean;
  };

  const placed: Placed[] = stations.map((station) => {
    const tone = stationTone(station.steps);
    if (sharedSplit && station.id === 'name') {
      return {
        station,
        tone,
        from: sharedSplit.name.from,
        to: sharedSplit.name.to,
        sharedWindow: true,
        openEnded: false,
      };
    }
    if (sharedSplit && station.id === 'incorporation') {
      return {
        station,
        tone,
        from: sharedSplit.inc.from,
        to: sharedSplit.inc.to,
        sharedWindow: true,
        openEnded: false,
      };
    }
    const intervals = station.steps
      .map((step) => stepInterval(step, schedule))
      .filter((interval): interval is { from: number; to: number } => Boolean(interval));
    if (intervals.length === 0) {
      return { station, tone, from: null, to: null, sharedWindow: false, openEnded: false };
    }
    const from = Math.min(...intervals.map((interval) => interval.from));
    let to = Math.max(...intervals.map((interval) => interval.to));
    const openEnded = (tone === 'waiting' || tone === 'current') && to < nowMs;
    if (openEnded) to = nowMs;
    return { station, tone, from, to, sharedWindow: false, openEnded };
  });

  const startMs = input.startDate ? utcDay(input.startDate) : NaN;
  const known = placed.flatMap((bar) => (bar.from != null && bar.to != null ? [bar.from, bar.to] : []));
  if (!Number.isNaN(startMs)) known.push(startMs);
  known.push(nowMs);

  let axisStart = Math.min(...known);
  let axisEnd = Math.max(...known);
  if (axisEnd - axisStart < 28 * DAY) axisEnd = axisStart + 28 * DAY;
  axisStart -= DAY;
  axisEnd += DAY;

  let cursor = !Number.isNaN(startMs) ? Math.max(startMs, axisStart) : axisStart + DAY;
  for (const bar of placed) {
    if (bar.from != null && bar.to != null) {
      cursor = Math.max(cursor, bar.to);
      continue;
    }
    if (bar.tone === 'upcoming') continue;
    const from = cursor;
    const to = Math.max(addDays(from, bar.station.milestone ? 0 : 1), nowMs);
    bar.from = from;
    bar.to = bar.station.milestone ? from : to;
    cursor = bar.to;
  }

  const undated = placed.filter((bar) => bar.from == null);
  if (undated.length > 0) {
    const last = placed.reduce((max, bar) => (bar.to != null ? Math.max(max, bar.to) : max), cursor);
    const room = Math.max(undated.length * 3 * DAY, axisEnd - last);
    const each = Math.max(3 * DAY, Math.floor(room / undated.length));
    let at = last;
    for (const bar of undated) {
      bar.from = at;
      bar.to = bar.station.milestone ? at : at + each;
      at = bar.to;
    }
    axisEnd = Math.max(axisEnd, at + DAY);
  }

  const spanDays = Math.max(1, daySpan(axisStart, axisEnd));
  const leftOf = (ms: number) => ((ms - axisStart) / DAY / spanDays) * 100;
  const widthOf = (from: number, to: number, milestone: boolean) => {
    const raw = ((to - from) / DAY / spanDays) * 100;
    return Math.max(raw, milestone ? 1.4 : 2.2);
  };

  const tickEvery = spanDays > 70 ? 14 : 7;
  const ticks: TimelineModel['ticks'] = [];
  for (let day = 0; day <= spanDays; day += tickEvery) {
    ticks.push({ label: formatDay(addDays(axisStart, day)), left: (day / spanDays) * 100 });
  }

  const bars: TimelineBarView[] = placed.map((bar) => {
    const from = bar.from ?? axisStart;
    const to = bar.to ?? from;
    const dated = bar.station.steps.some((step) => stepInterval(step, schedule)) || bar.sharedWindow;
    const rangeLabel = bar.openEnded
      ? `${formatDay(from)} – today`
      : dated
        ? formatRange(from, to, bar.station.milestone)
        : bar.tone === 'upcoming'
          ? 'Not set'
          : 'Through today';
    return {
      id: bar.station.id,
      label: bar.station.label,
      tone: bar.tone,
      locked: bar.tone === 'done',
      milestone: bar.station.milestone,
      sharedWindow: bar.sharedWindow,
      left: leftOf(from),
      width: bar.station.milestone ? 1.6 : widthOf(from, to, false),
      from: dated ? isoOf(from) : null,
      to: dated ? isoOf(to) : null,
      rangeLabel,
      startDay: daySpan(axisStart, from),
      endDay: daySpan(axisStart, to),
      steps: bar.station.steps.map((step) => {
        const interval = stepInterval(step, schedule);
        return {
          id: step.id,
          title: step.title,
          tone: toneOf(step.kind),
          dateLabel: interval ? formatRange(interval.from, interval.to, false) : 'Not set',
        };
      }),
    };
  });

  const headline = bars.every((bar) => bar.tone === 'done')
    ? 'Completed'
    : bars.some((bar) => bar.tone === 'waiting')
      ? 'Waiting for you'
      : 'In progress';

  const todayLeft = nowMs >= axisStart && nowMs <= axisEnd ? leftOf(nowMs) : null;

  return {
    axisStart: isoOf(axisStart),
    axisEnd: isoOf(axisEnd),
    spanDays,
    ticks,
    todayLeft,
    today: isoOf(nowMs),
    todayLabel: `Today ${formatDay(nowMs)}`,
    bars,
    headline,
    sharedNote: shared
      ? 'Name and incorporation share one date window. Each bar’s length follows how many steps it holds.'
      : null,
  };
}

const MONTH_YEAR = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * The scrollable range around the chart: whole months, a few before the first
 * bar and a few after the last, so the client can look back and ahead.
 * Day numbers count from `start`; `offset` is where the model's axis begins.
 */
export interface TimelineWorld {
  start: string;
  days: number;
  offset: number;
  today: number;
  months: { label: string; day: number }[];
  /** Mondays, as day numbers. */
  weeks: number[];
}

export function timelineWorld(model: TimelineModel, monthsBefore = 2, monthsAfter = 3): TimelineWorld {
  const axisStart = utcDay(model.axisStart);
  const axisEnd = utcDay(model.axisEnd);
  const first = new Date(axisStart);
  const startMs = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - monthsBefore, 1);
  const last = new Date(axisEnd);
  const endMs = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + monthsAfter + 1, 1);
  const days = daySpan(startMs, endMs);

  const months: TimelineWorld['months'] = [];
  const weeks: number[] = [];
  for (let day = 0; day <= days; day += 1) {
    const date = new Date(addDays(startMs, day));
    if (date.getUTCDate() === 1) months.push({ label: MONTH_YEAR.format(date), day });
    if (date.getUTCDay() === 1) weeks.push(day);
  }

  return {
    start: isoOf(startMs),
    days,
    offset: daySpan(startMs, axisStart),
    today: daySpan(startMs, utcDay(model.today)),
    months,
    weeks,
  };
}

/** "14 Oct" for a day number counted from an ISO start date. */
export function worldDayLabel(start: string, day: number): string {
  return formatDay(addDays(utcDay(start), day));
}

/** Move one bar and keep later unlocked bars from starting before it ends. */
export function shiftPhases(
  phases: PhaseSpan[],
  index: number,
  nextStart: number,
  nextEnd: number,
  mode: 'move' | 'start' | 'end',
  maxDay: number,
): PhaseSpan[] {
  const next = phases.map((phase) => ({ ...phase }));
  const current = next[index];
  if (!current || current.locked) return phases;

  const minStart = index > 0 ? next[index - 1]!.end : 0;
  let start = nextStart;
  let end = nextEnd;

  if (current.milestone) {
    start = Math.max(minStart, Math.min(maxDay, start));
    end = start;
  } else if (mode === 'move') {
    const width = Math.max(1, current.end - current.start);
    start = Math.max(minStart, start);
    end = Math.min(maxDay, start + width);
    start = Math.max(minStart, end - width);
  } else {
    start = Math.max(minStart, start);
    end = Math.max(start + 1, Math.min(maxDay, end));
  }

  const shift = end - current.end;
  current.start = start;
  current.end = end;

  for (let cursor = index + 1; cursor < next.length; cursor += 1) {
    const bar = next[cursor]!;
    if (bar.locked) break;
    const previous = next[cursor - 1]!;
    const width = bar.milestone ? 0 : Math.max(1, bar.end - bar.start);
    if (shift > 0 || bar.start > previous.end || bar.start < previous.end) {
      bar.start = Math.max(previous.end, bar.start + (shift > 0 ? shift : 0));
      bar.end = bar.milestone ? bar.start : Math.min(maxDay, bar.start + width);
      if (!bar.milestone && bar.end < bar.start + 1) bar.end = Math.min(maxDay, bar.start + 1);
    }
  }

  return next;
}

export function timelineStatusWord(tone: TimelineTone): string {
  return statusWord(tone);
}

/** Pre-incorporation steps, gated the way this viewer already sees the project. */
export function timelineStepsFromState(
  state: Record<string, ChecklistItemStateSlice | undefined>,
  viewer: ChecklistGateViewer,
): TimelineInputStep[] {
  const gates = gateActiveCatalog(state, viewer);
  const steps: TimelineInputStep[] = [];
  for (const phase of getPreIncPhases()) {
    for (const item of phase.items) {
      const slice = state[item.id];
      const completedOn = slice?.completedOn?.trim() || slice?.deliveredToClientAt?.trim() || undefined;
      steps.push({
        id: item.id,
        title: item.title,
        kind: getStepGate(gates, item.id).kind,
        completedOn,
      });
    }
  }
  return steps;
}

/** Calendar label for a proposed bar, counted in days from the chart's first day. */
export function labelForDayOffset(
  axisStart: string,
  start: number,
  end: number,
  milestone: boolean,
): string {
  const origin = utcDay(axisStart);
  if (Number.isNaN(origin)) return 'Not set';
  return formatRange(origin + start * DAY, origin + end * DAY, milestone);
}
