/**
 * PLANNER MODEL — the rows every planner view counts from (prototype
 * a59p_mgr_work.js: mxPlanTasks, mxSumStrip, mxTimeline, mxBoard, mxList,
 * mxMonthView, mxPlanWeek). Pure: no React, no fetch.
 *
 * One row per piece of real work:
 *   step / filing / request   the live lead work queue (`buildInternWorkItems`,
 *                             the same items a lead's own Tasks page shows)
 *   task                      a team task (`tasks` table) assigned to the person
 * Personal to-dos (no client, no date) stay in the to-do column.
 *
 * Status words are the console's one vocabulary (Overdue, Due this week, In
 * progress, Waiting on client, Not started, Done — `T_*` from Today). "Locked"
 * means a manager set the dates (a step's or filing's schedule window): the
 * planner shows them read-only with a lock.
 */
import type { InternWorkItem, InternWorkKind } from '@/lib/intern/intern-work';
import type { TaskInstance } from '@/data/engagements';
import type { AreaCode } from '@/lib/client-portal/compliances';
import type { PlannerBlockDto } from '@/lib/planner-blocks';
import { PLANNER_DAY_END_MIN, PLANNER_DAY_START_MIN } from '@/lib/planner-blocks';
import { addDays, daysBetween, dDay, dShort, istDay, weekOf, weekday, type TSt } from '../../today/model';

export { T_COLOR, T_LABEL, T_ORDER, T_PILL, type TSt } from '../../today/model';

export type PKind = 'step' | 'filing' | 'request' | 'task';
export type BoardCol = 'action' | 'progress' | 'waiting' | 'done';
export type Holder = 'you' | 'client' | 'manager';
export type CtaAction = 'open' | 'remind' | 'nudge-manager' | 'done';

export interface PlanItem {
  id: string;
  kind: PKind;
  title: string;
  /** "Pre-7", a filing's area, "Doc" or "Task". */
  code: string;
  clientId: string;
  clientName: string;
  st: TSt;
  due?: string;
  start?: string;
  dueLabel: string;
  /** Dates set by a manager (schedule window) — read-only on the planner. */
  locked: boolean;
  lockSetBy?: string;
  holder: Holder;
  /** The live queue's reason text ("Client submitted — review"). */
  why: string;
  board: BoardCol;
  cta: { label: string; action: CtaAction };
  area: AreaCode;
  /** Who leads it (intern key); the book planner shows it. */
  leadKey?: string;
  stepId?: string;
  filingId?: string;
  requestId?: string;
  taskId?: string;
  work?: InternWorkItem;
  task?: TaskInstance;
}

/* ================================================================ status */

const WAIT_KINDS: InternWorkKind[] = ['waiting-client', 'waiting-request'];

export function workStatus(w: Pick<InternWorkItem, 'kind' | 'isOverdue' | 'dueAt' | 'source'>, today: string): TSt {
  if (w.kind === 'done') return 'done';
  if (w.isOverdue) return 'over';
  if (WAIT_KINDS.includes(w.kind)) return 'wait';
  const due = istDay(w.dueAt);
  if (due) {
    const d = daysBetween(today, due);
    if (d < 0) return 'over';
    if (d <= 6) return 'due';
  }
  return w.source === 'filing' ? 'none' : 'run';
}

export function taskStatus(t: Pick<TaskInstance, 'status' | 'dueAt'>, today: string): TSt {
  if (t.status === 'completed' || t.status === 'not-applicable') return 'done';
  const due = istDay(t.dueAt);
  const d = due ? daysBetween(today, due) : undefined;
  if (d !== undefined && d < 0) return 'over';
  if (t.status === 'overdue') return 'over';
  if (d !== undefined && d <= 6) return 'due';
  if (t.status === 'in-progress') return 'run';
  if (t.status === 'awaiting-client') return 'wait';
  return 'none';
}

/** "Overdue 3d" · "Today" · "Fri 30 Oct" · "16 Nov" · "Done" · "No date" (prototype mxDueTag). */
export function dueLabel(st: TSt, due: string | undefined, today: string): string {
  if (st === 'done') return 'Done';
  if (!due) return 'No date';
  const d = daysBetween(today, due);
  if (d < 0) return `Overdue ${-d}d`;
  if (d === 0) return 'Today';
  if (d <= 6) return dDay(due, today);
  return dShort(due, today);
}

/* ================================================================ areas */

/** Area of law of a step, from its title (registrations); incorporation steps are MCA. */
export function stepArea(title: string): AreaCode {
  const t = title.toUpperCase();
  if (/FC-?GPR|FDI|ODI|FLA RETURN|FCTRS|STPI/.test(t)) return 'FEMA';
  if (/\bGST\b|\bLUT\b/.test(t)) return 'GST';
  if (/\bPAN\b|\bTAN\b/.test(t)) return 'IT';
  if (/\bPF\b|\bESI\b|\bPT\b|SHOPS|CLRA/.test(t)) return 'PAY';
  return 'MCA';
}

/* ================================================================ build */

export interface WorkCtx {
  today: string;
  /** Manager seat: a step waiting on the manager is "yours to review". */
  seat: 'mgr' | 'lead';
  stepTitle: (stepId: string) => string;
  stepCode: (stepId: string) => string;
  lockFor: (w: InternWorkItem) => { from: string; to: string; setBy?: string } | undefined;
  areaForFiling: (filingId: string) => AreaCode;
  board: (w: InternWorkItem) => BoardCol;
  cta: (w: InternWorkItem) => { label: string; action: 'open' | 'nudge-manager' | 'remind-client' | 'complete-task' };
  leadOf?: (engagementId: string) => string | undefined;
}

export function fromWork(w: InternWorkItem, c: WorkCtx): PlanItem {
  const st = workStatus(w, c.today);
  const lock = c.lockFor(w);
  const due = istDay(w.dueAt);
  const kind: PKind = w.source === 'step' ? 'step' : w.source === 'filing' ? 'filing' : 'request';
  const title = kind === 'step' && w.catalogId ? c.stepTitle(w.catalogId) : w.title;
  const area = kind === 'filing' && w.filingId ? c.areaForFiling(w.filingId) : stepArea(title);
  const live = c.cta(w);
  // A task's 'complete-task' is the planner's 'done' (Mark done).
  let cta: PlanItem['cta'] = {
    label: live.label,
    action: live.action === 'remind-client' ? 'remind' : live.action === 'complete-task' ? 'done' : live.action,
  };
  if (c.seat === 'mgr' && live.action === 'nudge-manager') cta = { label: 'Review', action: 'open' };
  const holder: Holder = WAIT_KINDS.includes(w.kind) ? 'client' : w.kind === 'waiting-manager' ? 'manager' : 'you';
  const startRaw = lock?.from ?? istDay(w.startedAt);
  const start = startRaw && due && startRaw > due ? due : startRaw;
  return {
    id: w.id,
    kind,
    title,
    code: kind === 'step' && w.catalogId ? c.stepCode(w.catalogId) : kind === 'filing' ? area : 'Doc',
    clientId: w.engagementId,
    clientName: w.companyName,
    st,
    due,
    start: start ?? due,
    dueLabel: dueLabel(st, due, c.today),
    locked: Boolean(lock),
    lockSetBy: lock?.setBy,
    holder,
    why: w.why,
    board: c.board(w),
    cta,
    area,
    leadKey: c.leadOf?.(w.engagementId),
    stepId: w.catalogId,
    filingId: w.filingId,
    requestId: w.requestId,
    work: w,
  };
}

export function fromTask(t: TaskInstance, clientName: string, today: string, leadKey?: string): PlanItem {
  const st = taskStatus(t, today);
  const due = istDay(t.dueAt);
  const title = t.title?.trim() || 'Task';
  return {
    id: `task:${t.id}`,
    kind: 'task',
    title,
    code: 'Task',
    clientId: t.engagementId,
    clientName,
    st,
    due,
    start: due,
    dueLabel: dueLabel(st, due, today),
    locked: false,
    holder: st === 'wait' ? 'client' : 'you',
    why: 'Team task',
    board: st === 'done' ? 'done' : st === 'over' || st === 'due' ? 'action' : st === 'run' ? 'progress' : 'waiting',
    cta: st === 'done' ? { label: 'Reopen', action: 'done' } : { label: 'Mark done', action: 'done' },
    area: stepArea(title),
    leadKey,
    taskId: t.id,
    task: t,
  };
}

const RANK: Record<TSt, number> = { over: 0, due: 1, run: 2, wait: 3, none: 4, done: 5 };
/** Overdue first, then by due date, then client (prototype mxSort). */
export function sortPlan(a: PlanItem, b: PlanItem): number {
  return RANK[a.st] - RANK[b.st] || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.clientName.localeCompare(b.clientName) || a.title.localeCompare(b.title);
}

/* ================================================================ filters */

export type Show = 'all' | 'steps' | 'filings';
export interface PlanFilter {
  clients: string[];
  show: Show;
  day?: string | null;
}
/** The day an item sits on (live internWeekAnchorYmd): done → the day it was done; open → its due date when still ahead, else today. */
export function anchorDay(i: PlanItem, today: string): string | undefined {
  if (i.st === 'done') return istDay(i.work?.completedAt) ?? i.due;
  return i.due && i.due > today ? i.due : today;
}
export function applyFilter(items: PlanItem[], f: PlanFilter, today: string): PlanItem[] {
  return items.filter(
    (i) =>
      (!f.clients.length || f.clients.includes(i.clientId)) &&
      (f.show === 'all' || (f.show === 'filings') === (i.kind === 'filing')) &&
      (!f.day || anchorDay(i, today) === f.day),
  );
}

/* ================================================================ summary strip */

export interface Summary {
  open: PlanItem[];
  over: PlanItem[];
  due: PlanItem[];
  wait: PlanItem[];
  /** Hours of blocks on the calendar this week (Mon–Sun). */
  hours: number;
}
export function summarize(items: PlanItem[], blocks: PlannerBlockDto[], today: string): Summary {
  const open = items.filter((i) => i.st !== 'done');
  const week = weekOf(today);
  const min = blocks.filter((b) => b.day >= week[0]! && b.day <= week[6]!).reduce((n, b) => n + (b.endMin - b.startMin), 0);
  return {
    open,
    over: open.filter((i) => i.st === 'over'),
    due: open.filter((i) => i.st === 'due'),
    wait: open.filter((i) => i.st === 'wait'),
    hours: Math.round((min / 60) * 10) / 10,
  };
}
export const hoursText = (h: number): string => `${Number.isInteger(h) ? h : h.toFixed(1)} h`;

/* ================================================================ timeline (fortnight) */

export interface TlRow {
  item: PlanItem;
  /** 0-based inclusive columns in the window. */
  a: number;
  z: number;
  /** Due day falls in the window: its column, else -1. */
  dueCol: number;
  bar: 'm' | 'late' | 'o' | 'w' | 'f' | 'd';
}
export interface Timeline {
  days: string[];
  rows: TlRow[];
  later: PlanItem[];
}
/** Two weeks from this Monday (the live lead timeline's window). */
export function timeline(items: PlanItem[], today: string): Timeline {
  const days = Array.from({ length: 14 }, (_, i) => addDays(weekOf(today)[0]!, i));
  const first = days[0]!;
  const last = days[13]!;
  const rows: TlRow[] = [];
  const later: PlanItem[] = [];
  for (const item of [...items].sort(sortPlan)) {
    const end = item.due ?? (item.st === 'done' ? undefined : today);
    if (!end) continue;
    const start = item.start && item.start <= end ? item.start : end;
    if (end < first) {
      if (item.st !== 'done') rows.push({ item, a: 0, z: 0, dueCol: -1, bar: barOf(item) });
      continue;
    }
    if (start > last) {
      if (item.st !== 'done') later.push(item);
      continue;
    }
    rows.push({
      item,
      a: Math.max(0, daysBetween(first, start)),
      z: Math.min(13, daysBetween(first, end)),
      dueCol: item.due && item.due >= first && item.due <= last ? daysBetween(first, item.due) : -1,
      bar: barOf(item),
    });
  }
  return { days, rows, later };
}
export function barOf(i: PlanItem): TlRow['bar'] {
  if (i.st === 'done') return 'd';
  if (i.st === 'over') return 'late';
  if (i.st === 'wait') return 'w';
  if (i.kind === 'filing') return 'f';
  return i.locked ? 'm' : 'o';
}

/* ================================================================ board */

export const BOARD: Array<{ key: BoardCol; label: string; color: string }> = [
  { key: 'action', label: 'Needs action', color: 'var(--due)' },
  { key: 'progress', label: 'In progress', color: 'var(--mx-run)' },
  { key: 'waiting', label: 'Waiting', color: 'var(--mx-wait)' },
  { key: 'done', label: 'Done this week', color: 'var(--mx-ok)' },
];
export function boardCols(items: PlanItem[]): Record<BoardCol, PlanItem[]> {
  const out: Record<BoardCol, PlanItem[]> = { action: [], progress: [], waiting: [], done: [] };
  for (const i of [...items].sort(sortPlan)) out[i.board].push(i);
  return out;
}

/* ================================================================ month */

export interface MonthCell {
  day: string;
  out: boolean;
  items: PlanItem[];
  blocks: PlannerBlockDto[];
  worst: 'over' | 'due' | 'has' | '';
}
/** Mon-first grid of the month holding `anyDay`, with each day's open items and blocks. */
export function monthGrid(anyDay: string, items: PlanItem[], blocks: PlannerBlockDto[]): MonthCell[] {
  const first = `${anyDay.slice(0, 7)}-01`;
  const start = weekOf(first)[0]!;
  const month = anyDay.slice(0, 7);
  const cells: MonthCell[] = [];
  for (let d = start; cells.length < 42; d = addDays(d, 1)) {
    if (cells.length >= 35 && d.slice(0, 7) !== month && weekday(d) === 'Mon') break;
    const its = items.filter((i) => i.st !== 'done' && i.due === d);
    const bl = blocks.filter((b) => b.day === d);
    cells.push({
      day: d,
      out: d.slice(0, 7) !== month,
      items: its,
      blocks: bl,
      worst: its.some((i) => i.st === 'over') ? 'over' : its.some((i) => i.st === 'due') ? 'due' : its.length || bl.length ? 'has' : '',
    });
  }
  return cells;
}

/* ================================================================ times */

/** "2:30 pm", "14:30", "2pm", "230", "9" → minutes after midnight; NaN when unreadable (prototype mxParseT). */
export function parseTime(v: string): number {
  let t = String(v || '').trim().toLowerCase().replace(/\s+/g, '').replace('.', ':');
  const pm = /p/.test(t);
  const am = /a/.test(t);
  t = t.replace(/[apm]/g, '');
  let hh: number;
  let m = 0;
  let x: RegExpExecArray | null;
  if ((x = /^(\d{1,2}):(\d{1,2})$/.exec(t))) {
    hh = +x[1]!;
    m = +x[2]!;
  } else if ((x = /^(\d{3,4})$/.exec(t))) {
    hh = Math.floor(+x[1]! / 100);
    m = +x[1]! % 100;
  } else if ((x = /^(\d{1,2})$/.exec(t))) hh = +x[1]!;
  else return NaN;
  if (m > 59 || hh > 23) return NaN;
  if (pm && hh < 12) hh += 12;
  if (am && hh === 12) hh = 0;
  if (!pm && !am && hh >= 1 && hh <= 7) hh += 12;
  return hh * 60 + m;
}
const clock = (min: number) => `${Math.floor(min / 60) % 12 || 12}:${String(min % 60).padStart(2, '0')}`;
const ampm = (min: number) => (min >= 720 ? 'pm' : 'am');
/** "2:30 pm" */
export const fmtTime = (min: number): string => `${clock(min)} ${ampm(min)}`;
/** "2:30 to 4:00 pm", "11:30 am to 1:00 pm" */
export function fmtRange(a: number, z: number): string {
  return ampm(a) === ampm(z) ? `${clock(a)} to ${clock(z)} ${ampm(z)}` : `${fmtTime(a)} to ${fmtTime(z)}`;
}
/** "1 h 30 min block" */
export function durText(min: number): string {
  const h = Math.floor(min / 60);
  const r = min % 60;
  return `${h ? `${h} h` : ''}${h && r ? ' ' : ''}${r ? `${r} min` : ''} block`;
}

/* ================================================================ plan my week */

export interface PlanRules {
  /** Keep 9 to 11 am free for deep work. */
  deep: boolean;
  /** Overdue and filing-related first. */
  first: boolean;
  /** Group work by client. */
  group: boolean;
}
export interface Suggestion {
  item: PlanItem;
  day: string;
  a: number;
  z: number;
  refused?: string;
}
/** The working days a plan covers: five weekdays from today (or the next Monday at the weekend). */
export function planDays(today: string): string[] {
  const out: string[] = [];
  for (let d = today; out.length < 5; d = addDays(d, 1)) if (weekday(d) !== 'Sat' && weekday(d) !== 'Sun') out.push(d);
  return out;
}
const LEN: Record<PKind, number> = { step: 90, filing: 60, task: 60, request: 30 };
const DAY_CAP = 6 * 60;

/**
 * Lays the open work into free time (prototype mxPlanWeek): overdue and
 * due-soon first, each item on the earliest day with room before its due
 * date, never over existing blocks. Items waiting on the client are left
 * out; work with a manager window that ended before the first day is
 * refused ("outside the task span"). `seed` rotates equal-ranked items
 * (Reshuffle).
 */
export function planWeek(items: PlanItem[], existing: PlannerBlockDto[], days: string[], rules: PlanRules, seed = 0): Suggestion[] {
  const horizon = addDays(days[days.length - 1]!, 7);
  const planned = new Set(existing.map((b) => b.itemRef).filter(Boolean));
  const pool = items.filter((i) => i.st !== 'done' && i.st !== 'wait' && i.kind !== 'request' && !planned.has(i.id) && (!i.due || i.due <= horizon));
  const rank = (i: PlanItem) => (rules.first ? (i.st === 'over' ? 0 : i.kind === 'filing' ? 1 : 2) : 0);
  const sorted = [...pool].sort((a, b) => rank(a) - rank(b) || (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  if (seed && sorted.length > 1) {
    // rotate within runs of the same rank and due date
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && rank(sorted[j + 1]!) === rank(sorted[i]!) && sorted[j + 1]!.due === sorted[i]!.due) j++;
      const run = sorted.slice(i, j + 1);
      const k = seed % run.length;
      sorted.splice(i, run.length, ...run.slice(k), ...run.slice(0, k));
      i = j + 1;
    }
  }
  const busy = new Map<string, Array<[number, number]>>(days.map((d) => [d, existing.filter((b) => b.day === d).map((b) => [b.startMin, b.endMin] as [number, number])]));
  const load = (d: string) => (busy.get(d) ?? []).reduce((n, [a, z]) => n + z - a, 0);
  const out: Suggestion[] = [];
  for (const item of sorted.slice(0, 40)) {
    const len = LEN[item.kind];
    if (item.locked && item.due && item.due < days[0]!) {
      out.push({ item, day: days[0]!, a: PLANNER_DAY_START_MIN, z: PLANNER_DAY_START_MIN + len, refused: `Outside the task span (it ended ${dShort(item.due, days[0]!)})` });
      continue;
    }
    const lastOk = item.due && item.due >= days[0]! ? item.due : days[days.length - 1]!;
    let order = days.filter((d) => d <= lastOk);
    if (rules.group) {
      const same = out.filter((s) => !s.refused && s.item.clientId === item.clientId).map((s) => s.day);
      order = [...order.filter((d) => same.includes(d)), ...order.filter((d) => !same.includes(d))];
    }
    const deepFree = rules.deep && item.kind !== 'filing' && item.st !== 'over';
    let placed: Suggestion | undefined;
    for (const d of order) {
      if (load(d) + len > DAY_CAP) continue;
      const taken = [...(busy.get(d) ?? [])].sort((p, q) => p[0] - q[0]);
      let a = deepFree ? Math.max(PLANNER_DAY_START_MIN, 11 * 60) : PLANNER_DAY_START_MIN;
      for (const [s, e] of taken) {
        if (a + len <= s) break;
        if (e > a) a = e;
      }
      if (a + len <= PLANNER_DAY_END_MIN) {
        placed = { item, day: d, a, z: a + len };
        busy.get(d)!.push([a, a + len]);
        break;
      }
    }
    out.push(placed ?? { item, day: days[0]!, a: PLANNER_DAY_START_MIN, z: PLANNER_DAY_START_MIN + len, refused: 'No free time before its due date' });
  }
  return out;
}

/* ================================================================ lead analysis */

export const AREAS: AreaCode[] = ['MCA', 'GST', 'IT', 'PAY', 'FEMA'];
export interface AreaBar {
  area: AreaCode;
  done: number;
  pending: number;
  over: number;
  rest: number;
  total: number;
}
export function areaBars(items: PlanItem[]): AreaBar[] {
  return AREAS.map((area) => {
    const its = items.filter((i) => i.area === area);
    const done = its.filter((i) => i.st === 'done').length;
    const over = its.filter((i) => i.st === 'over').length;
    const pending = its.filter((i) => i.st === 'run' || i.st === 'due' || i.st === 'wait').length;
    return { area, done, pending, over, rest: its.length - done - over - pending, total: its.length };
  });
}

/** Steps done on or before their manager window's end, of the steps done that had one. */
export function onTimeRate(pairs: Array<{ doneOn: string; due: string }>): { pct: number | null; n: number } {
  if (!pairs.length) return { pct: null, n: 0 };
  const ok = pairs.filter((p) => p.doneOn <= p.due).length;
  return { pct: Math.round((ok / pairs.length) * 100), n: pairs.length };
}

/* ================================================================ export */

export function csv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
}
