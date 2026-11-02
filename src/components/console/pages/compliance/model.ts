/**
 * COMPLIANCE CALENDAR + FILINGS REGISTER — the lists both pages count from.
 * Pure: no React, no fetch.
 *
 *   book   every client in view (Stage filter applied) and its rows for one
 *          financial year: the register (`/api/filings`, enriched with the
 *          portal read for period, proofs, ARN and the caller's reminder) and,
 *          for a client whose register has NO rows this FY, the deadlines from
 *          SBC's statutory calendar that apply to it (owner's never-empty rule;
 *          the client portal's `statutoryFilings`). Register rows always win.
 *   sbc    SBC's master statutory calendar (live StatutoryCalendar): the
 *          deadlines that apply to the picked company, or to any client in view.
 *
 * Status vocabulary is Today's (README): Filed on time, Filed late, Overdue,
 * Due this week (0–6 days), Upcoming — plus "SBC calendar" for a calendar line
 * that is not on a register yet (never overdue or filed).
 *
 *   tasks  NON-STATUTORY TASKS (docs/ui-port/COMPLIANCE-API.md section 2, spec
 *          rows C-1..C-4 and F-1..F-3): `GET /api/compliances/tasks?from=&to=`
 *          for the FY. A task sits on its END date, carries the server's
 *          six-word status (`word`) and, once done, its deliverable file. It
 *          has no regulator, so an area pick hides tasks and the "Task" mark
 *          (hollow square) replaces the law tag.
 */
import type { Engagement } from '@/data/engagements';
import {
  ACT_META,
  ACT_ORDER,
  STATUTORY_DEADLINES,
  deadlineAppliesTo,
  type StatutoryAct,
} from '@/data/statutory-calendar-fy2627';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import {
  AREA_LABEL,
  AREA_ORDER,
  areaOf,
  authorityName,
  csvEscape,
  displayName,
  displayPeriod,
  freqLabel,
  type AreaCode,
  type PortalFiling,
} from '@/lib/client-portal/compliances';
import { companyShortName } from '@/lib/client-portal/company';
import { projectedWindow } from '@/lib/client-portal/master-plan';
import { statutoryFilings } from '@/lib/client-portal/statutory-fallback';
import { buildIncorporationModel } from '@/lib/client-portal/step-model';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import { financialYearLabel, financialYearMonths, quarterForMonthKey, type FilingRow } from '@/lib/compliance/filings';
import type { Stage as TaskStage, StatusWord, Urgency, Visibility } from '@/lib/compliance-tasks/model';
import { showStat, showTasks, STATUS_WORDS, type Category } from '@/components/client-portal/pages/compliances/tasks';
import {
  addDays,
  daysBetween,
  dShort,
  F_COLOR,
  F_LABEL,
  F_PILL,
  filingSt,
  initialsOf,
  istDay,
  type FSt,
  type LeadPerson,
  type Scope,
} from '../today/model';

/* ================================================================ vocabulary */

export type CSt = FSt | 'c';
/** Legend / donut order. */
export const C_ORDER: CSt[] = ['f', 'l', 'o', 'd', 'u', 'c'];
const WORST: CSt[] = ['o', 'd', 'u', 'c', 'l', 'f'];
export const C_LABEL: Record<CSt, string> = { ...F_LABEL, c: 'SBC calendar' };
export const C_SHORT: Record<CSt, string> = { f: 'Filed', l: 'Late', o: 'Overdue', d: 'This week', u: 'Upcoming', c: 'SBC' };
export const C_COLOR: Record<CSt, string> = { ...F_COLOR, c: 'var(--done)' };
export const C_PILL: Record<CSt, string> = { ...F_PILL, c: 'mut' };
export const C_TIP: Record<CSt, string> = {
  f: 'Filed on or before its due date',
  l: 'Filed after its due date',
  o: 'Not filed and past its due date',
  d: 'Not filed, due in the next 7 days',
  u: 'Not filed, due in more than 7 days',
  c: 'From SBC’s compliance calendar: the client has no filings on its register yet. It applies once SBC adds it to the register; no proof, reminder or window until then',
};

export type Cadence = 'monthly' | 'quarterly' | 'annual';
export const CADENCES: Cadence[] = ['monthly', 'quarterly', 'annual'];
export const CADENCE_LABEL: Record<Cadence, string> = { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' };
/** The live register's tabs (`rowsForCadence`): half-yearly sits with quarterly, one-time with annual. */
export function cadenceOf(freq: string): Cadence | null {
  const f = freq.trim().toLowerCase();
  if (f === 'monthly') return 'monthly';
  if (f === 'quarterly' || f === 'half-yearly') return 'quarterly';
  if (f === 'annual' || f === 'one-time') return 'annual';
  return null;
}
export const isCadence = (v: string | null | undefined): v is Cadence => v === 'monthly' || v === 'quarterly' || v === 'annual';

/* ================================================================ shapes */

export interface CRow {
  id: string;
  clientId: string;
  clientName: string;
  due: string;
  filedOn?: string;
  st: CSt;
  /** due − today, in days */
  days: number;
  area: AreaCode;
  name: string;
  particular: string;
  period: string;
  freq: string;
  freqLabel: string;
  cadence: Cadence | null;
  authority: string;
  authorityName: string;
  window?: { from: string; to: string };
  /** a line from SBC's calendar, not a register row */
  cal: boolean;
  reg?: FilingRow;
  portal?: PortalFiling;
  proofs: number;
  reminderOn?: string;
}

export interface BookClient {
  id: string;
  e?: Engagement;
  name: string;
  short: string;
  initials: string;
  stage: 'inc' | 'cmp';
  incorporated: boolean;
  inScope: boolean;
  leadName?: string;
  registerRows: number;
  calRows: number;
  /** why its rows come from SBC's calendar */
  fallback?: 'pre' | 'nogen';
}

export interface Book {
  today: string;
  fy: number;
  fyLabel: string;
  all: BookClient[];
  /** in the Stage filter, by name */
  clients: BookClient[];
  byId: Record<string, BookClient>;
  rows: CRow[];
  /** clients in view whose rows are SBC calendar lines */
  fallback: BookClient[];
  /** clients in view not incorporated yet */
  pre: BookClient[];
  /** the portal read (proofs, ARN, reminders) arrived */
  enriched: boolean;
}

export interface BookInput {
  today: string;
  fy: number;
  scope: Scope;
  engagements: Engagement[];
  stateFor: (e: Engagement) => Record<string, ChecklistItemStateSlice | undefined> | undefined;
  register: FilingRow[];
  portal?: PortalFiling[];
  leads?: LeadPerson[];
}

/* ================================================================ build */

/**
 * When the company exists (the client portal's `useFilings` rule): the real
 * incorporation date, else the Pre-12 done date, else SBC's expected COI date,
 * else the playbook projection. A company that started with SBC already
 * incorporated (stage past Pre-Incorporation) simply exists.
 */
export function existsFromOf(
  e: Engagement,
  state: Record<string, ChecklistItemStateSlice | undefined> | undefined,
  today: string,
): string | undefined {
  const inc = istDay(e.incorporationDate);
  if (inc) return inc;
  const model = buildIncorporationModel(state ?? {}, e.schedule ?? null, today);
  const coi = model.byId['pre-12'];
  if (coi?.kind === 'done' && coi.doneOn) return coi.doneOn;
  if (e.stage && e.stage !== 'Pre-Incorporation') return undefined;
  if (model.coiExpected) return model.coiExpected;
  const created = istDay(e.createdAt);
  const firstDone = model.steps
    .map((s) => s.doneOn)
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const base = firstDone && created && firstDone < created ? firstDone : created ?? firstDone;
  return base && coi ? projectedWindow(coi.item.deadline, base, undefined)?.[1] : undefined;
}

const clean = (s?: string | null): string => (s && s.trim() !== '—' ? s.trim() : '');

function regRow(r: FilingRow, p: PortalFiling | undefined, c: BookClient, today: string): CRow {
  const due = r.dueDate.slice(0, 10);
  return {
    id: r.id,
    clientId: c.id,
    clientName: c.name,
    due,
    filedOn: istDay(r.filedOn),
    st: filingSt(r, today),
    days: daysBetween(today, due),
    area: p?.area ?? areaOf(r.authority, r.compliance),
    name: p?.name ?? displayName(r.particular),
    particular: r.particular,
    period: clean(p?.period ?? displayPeriod(null, null, r.periodLabel, r.fyLabel, r.particular, due)),
    freq: r.frequency,
    freqLabel: freqLabel(r.frequency),
    cadence: cadenceOf(r.frequency),
    authority: r.authority,
    authorityName: p?.authorityName ?? authorityName(r.authority),
    window: r.windowFrom && r.windowTo ? { from: r.windowFrom.slice(0, 10), to: r.windowTo.slice(0, 10) } : undefined,
    cal: false,
    reg: r,
    portal: p,
    proofs: p?.proofCount ?? 0,
    reminderOn: p?.reminderOn ?? undefined,
  };
}

function lineRow(p: PortalFiling, c: BookClient, today: string): CRow {
  return {
    id: `cal:${c.id}:${p.id.replace(/^cal:/, '')}`,
    clientId: c.id,
    clientName: c.name,
    due: p.dueDate,
    st: 'c',
    days: daysBetween(today, p.dueDate),
    area: p.area,
    name: p.name,
    particular: p.particular,
    period: clean(p.period),
    freq: p.frequency,
    freqLabel: p.freqLabel,
    cadence: cadenceOf(p.frequency),
    authority: p.authority,
    authorityName: p.authorityName,
    cal: true,
    portal: p,
    proofs: 0,
  };
}

const byDueThenName = (a: CRow, b: CRow) => a.due.localeCompare(b.due) || a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name);

export function buildBook(input: BookInput): Book {
  const { today, fy, scope } = input;
  const from = `${fy}-04-01`;
  const to = `${fy + 1}-03-31`;
  const portalById = new Map((input.portal ?? []).map((p) => [p.id, p]));
  const leadName = new Map((input.leads ?? []).filter((l) => l.internId).map((l) => [l.internId!, l.name]));
  const regBy = new Map<string, FilingRow[]>();
  for (const r of input.register) {
    const d = r.dueDate.slice(0, 10);
    if (d < from || d > to) continue;
    const list = regBy.get(r.engagementId) ?? [];
    list.push(r);
    regBy.set(r.engagementId, list);
  }
  const inView = (stage: 'inc' | 'cmp') => scope === 'all' || scope === stage;
  const all: BookClient[] = [];
  const rows: CRow[] = [];
  const seen = new Set<string>();
  for (const e of input.engagements) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const state = input.stateFor(e);
    const incorporated = isIncorporated(e, state ?? null);
    const stage = incorporated ? 'cmp' : 'inc';
    const reg = regBy.get(e.id) ?? [];
    const lines = reg.length ? [] : statutoryFilings(e, fy, today, existsFromOf(e, state, today));
    const leadKey = e.internId?.trim() || e.leadIds?.[0];
    const c: BookClient = {
      id: e.id,
      e,
      name: e.companyName,
      short: companyShortName(e.companyName) || e.companyName,
      initials: initialsOf(e.companyName),
      stage,
      incorporated,
      inScope: inView(stage),
      leadName: leadKey ? leadName.get(leadKey) : undefined,
      registerRows: reg.length,
      calRows: lines.length,
      fallback: reg.length ? undefined : incorporated ? 'nogen' : 'pre',
    };
    all.push(c);
    if (!c.inScope) continue;
    for (const r of reg) rows.push(regRow(r, portalById.get(r.id), c, today));
    for (const p of lines) rows.push(lineRow(p, c, today));
  }
  // register rows of a company not on the roster (the live views listed every row the API returned)
  for (const [id, reg] of regBy) {
    if (seen.has(id)) continue;
    const name = reg[0]!.companyName;
    const c: BookClient = { id, name, short: companyShortName(name) || name, initials: initialsOf(name), stage: 'cmp', incorporated: true, inScope: inView('cmp'), registerRows: reg.length, calRows: 0 };
    all.push(c);
    if (c.inScope) for (const r of reg) rows.push(regRow(r, portalById.get(r.id), c, today));
  }
  all.sort((a, b) => a.name.localeCompare(b.name));
  rows.sort(byDueThenName);
  const clients = all.filter((c) => c.inScope);
  return {
    today,
    fy,
    fyLabel: financialYearLabel(fy),
    all,
    clients,
    byId: Object.fromEntries(all.map((c) => [c.id, c])),
    rows,
    fallback: clients.filter((c) => c.calRows > 0),
    pre: clients.filter((c) => !c.incorporated),
    enriched: input.portal !== undefined,
  };
}

/* ================================================================ filters */

export type StatusFilter = 'all' | 'f' | 'o' | 'd' | 'u' | 'c';
export const STATUS_FILTER_LABEL: Record<Exclude<StatusFilter, 'all'>, string> = { f: 'Filed', o: 'Overdue', d: 'Due this week', u: 'Upcoming', c: 'SBC calendar' };
const STATUS_PARAM: Record<Exclude<StatusFilter, 'all'>, string> = { f: 'filed', o: 'overdue', d: 'due-soon', u: 'upcoming', c: 'calendar' };
/** `?status=` — the live register's values (filed / overdue / due-soon / upcoming) plus `calendar`. */
export function parseStatus(v?: string | null): StatusFilter {
  const hit = (Object.keys(STATUS_PARAM) as Array<Exclude<StatusFilter, 'all'>>).find((k) => STATUS_PARAM[k] === v || k === v);
  return hit ?? 'all';
}
export const statusParam = (s: StatusFilter): string | null => (s === 'all' ? null : STATUS_PARAM[s]);
export const matchStatus = (st: CSt, f: StatusFilter): boolean => f === 'all' || (f === 'f' ? st === 'f' || st === 'l' : st === f);

export type AreaFilter = 'all' | AreaCode;
export const parseArea = (v?: string | null): AreaFilter => (AREA_ORDER.includes(v as AreaCode) ? (v as AreaCode) : 'all');

export interface RowFilter {
  company?: string;
  area?: AreaFilter;
  status?: StatusFilter;
  cadence?: Cadence | null;
  /** YYYY-MM */
  month?: string;
}
export function filterRows(rows: CRow[], f: RowFilter): CRow[] {
  return rows.filter(
    (r) =>
      (!f.company || f.company === 'all' || r.clientId === f.company) &&
      (!f.area || f.area === 'all' || r.area === f.area) &&
      (!f.status || matchStatus(r.st, f.status)) &&
      (!f.cadence || r.cadence === f.cadence) &&
      (!f.month || r.due.slice(0, 7) === f.month),
  );
}

/* ================================================================ counts */

export function countSt(rows: Array<{ st: CSt }>): Record<CSt, number> {
  const n: Record<CSt, number> = { f: 0, l: 0, o: 0, d: 0, u: 0, c: 0 };
  for (const r of rows) n[r.st] += 1;
  return n;
}

export function areaStats(rows: CRow[]): Array<{ area: AreaCode; label: string; register: number; filed: number; lines: number }> {
  return AREA_ORDER.map((area) => {
    const of = rows.filter((r) => r.area === area);
    return {
      area,
      label: AREA_LABEL[area],
      register: of.filter((r) => !r.cal).length,
      filed: of.filter((r) => r.st === 'f' || r.st === 'l').length,
      lines: of.filter((r) => r.cal).length,
    };
  });
}

export function worstOf(sts: Iterable<CSt>): CSt | null {
  const s = new Set(sts);
  return WORST.find((x) => s.has(x)) ?? null;
}

export function byDay<T extends { due: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const list = m.get(r.due) ?? [];
    list.push(r);
    m.set(r.due, list);
  }
  return m;
}

/** The next deadline from today: the earliest unfiled register row, else (no register rows) the earliest SBC line. */
export function nextDeadline(rows: CRow[], today: string): CRow | undefined {
  const open = rows.filter((r) => !r.filedOn && r.due >= today);
  return open.find((r) => !r.cal) ?? open.find((r) => r.cal);
}

export const overdueRows = (rows: CRow[]): CRow[] => rows.filter((r) => r.st === 'o');

/** Unfiled rows due from today to today + n days (prototype "Coming up · next 14 days"). */
export function comingUp(rows: CRow[], today: string, n = 14): CRow[] {
  const end = addDays(today, n);
  return rows.filter((r) => !r.filedOn && r.due >= today && r.due <= end);
}

/* ================================================================ calendar items (both sources) */

export interface CalItem {
  id: string;
  due: string;
  st: CSt;
  area: AreaCode | null;
  /** chip text */
  tag: string;
  title: string;
  sub: string;
  kind: 'filing' | 'line' | 'sbc' | 'task';
  /** task only: "Starts 12 Oct · High" (C-3 hover) */
  hint?: string;
  /** task only: the six-word status chip */
  word?: StatusWord;
}

export function rowItem(r: CRow, withClient: boolean): CalItem {
  return {
    id: r.id,
    due: r.due,
    st: r.st,
    area: r.area,
    tag: r.area,
    title: r.name,
    sub: [withClient ? r.clientName : '', r.period].filter(Boolean).join(' · '),
    kind: r.cal ? 'line' : 'filing',
  };
}

export interface YearCard {
  key: string;
  label: string;
  short: string;
  n: number;
  counts: Record<CSt, number>;
}
export function yearCards(items: Array<{ due: string; st: CSt }>, fy: number): YearCard[] {
  return financialYearMonths(fy).map((m) => {
    const of = items.filter((r) => r.due.slice(0, 7) === m.key);
    return { key: m.key, label: m.label, short: m.shortLabel, n: of.length, counts: countSt(of) };
  });
}

export interface Lane {
  key: string;
  area: AreaCode | null;
  label: string;
  days: Array<{ day: number; items: CalItem[] }>;
}
/** Timeline: one lane per area (plus "Other" for acts with no area), the month's items by day. */
export function lanes(items: CalItem[], monthKey: string, area: AreaFilter): Lane[] {
  const inMonth = items.filter((i) => i.due.slice(0, 7) === monthKey);
  const keys: Array<AreaCode | null> = area === 'all' ? [...AREA_ORDER, null] : [area];
  return keys
    .map((a) => {
      const of = inMonth.filter((i) => i.area === a);
      const days = [...byDay(of).entries()].map(([d, list]) => ({ day: Number(d.slice(8, 10)), items: list })).sort((x, y) => x.day - y.day);
      return { key: a ?? 'other', area: a, label: a ? AREA_LABEL[a] : 'Other', days };
    })
    .filter((l) => l.area !== null || l.days.length > 0);
}

/** Days in a `YYYY-MM` month. */
export function monthDays(key: string): number {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Arrow keys on a month grid: ±1 day, ±7 days, Home / End; never leaves the month. */
export function moveDay(iso: string, key: string): string | null {
  const step = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : key === 'ArrowUp' ? -7 : key === 'ArrowDown' ? 7 : 0;
  const mk = iso.slice(0, 7);
  if (step) {
    const n = addDays(iso, step);
    return n.slice(0, 7) === mk ? n : null;
  }
  if (key === 'Home') return `${mk}-01`;
  if (key === 'End') return `${mk}-${String(monthDays(mk)).padStart(2, '0')}`;
  return null;
}

/* ================================================================ non-statutory tasks (C-1..C-4, F-1..F-3) */

export { showStat, showTasks, STATUS_WORDS, type Category };
export const CATEGORIES: Category[] = ['all', 'statutory', 'non-statutory'];
export const CATEGORY_LABEL: Record<Category, string> = { all: 'All', statutory: 'Statutory', 'non-statutory': 'Non-statutory' };
/** `?cat=` — `statutory` | `non-statutory`; anything else is All. */
export const parseCat = (v?: string | null): Category => (v === 'statutory' || v === 'non-statutory' ? v : 'all');
export const catParam = (c: Category): string | null => (c === 'all' ? null : c);

/** The fields of a `TaskRow` (COMPLIANCE-API.md section 2) the console reads. */
export interface ConsoleTask {
  id: string;
  engagementId: string;
  companyName: string;
  activityName: string | null;
  name: string;
  periodLabel: string | null;
  title: string;
  startDate: string;
  /** the end date */
  dueDate: string;
  urgency: Urgency;
  urgencyBars: 1 | 2 | 3 | 4;
  visibility: Visibility;
  stage: TaskStage;
  stageLabel: string;
  word: StatusWord;
  hidden: boolean;
  owner: { id: string; name: string } | null;
  attachmentCount: number;
  deliverable: { id: string; fileName: string } | null;
  completedAt: string | null;
}

export const TASK_ID_PREFIX = 'task:';
/** The task page under the console base (`/app/manager/compliances/obligations/tasks/<id>`). */
export const taskPath = (base: string, taskId: string): string => `${base}/compliances/obligations/tasks/${encodeURIComponent(taskId)}`;

/** Pill class and colour of each of the six status words (README vocabulary colours). */
export const WORD_PILL: Record<StatusWord, string> = { Overdue: 'over', 'Due soon': 'due', Waiting: 'mut', 'In progress': 'up', 'Not started': 'na', Done: 'ok' };
export const WORD_COLOR: Record<StatusWord, string> = {
  Overdue: 'var(--over)',
  'Due soon': 'var(--due)',
  Waiting: 'var(--mx-wait)',
  'In progress': 'var(--mx-run)',
  'Not started': 'var(--mx-none)',
  Done: 'var(--mx-ok)',
};

/** A task on the calendar or the register, keyed like a row: it sits on its END date. */
export interface TRow {
  /** `task:<id>` — never collides with a register row id */
  id: string;
  taskId: string;
  clientId: string;
  clientName: string;
  /** the end date (C-3) */
  due: string;
  start: string;
  /** the calendar colour, by the filing rule: done = filed, past = overdue, 0–6 days = due this week, else upcoming */
  st: CSt;
  /** the six-word chip */
  word: StatusWord;
  stageLabel: string;
  urgency: Urgency;
  bars: number;
  name: string;
  /** name · period */
  title: string;
  period: string | null;
  owner: string | null;
  deliverable: { id: string; fileName: string } | null;
  /** the day it was completed (India) */
  completedOn?: string;
  done: boolean;
  /** due − today, in days */
  days: number;
  /** "Starts 12 Oct · High" */
  hint: string;
  task: ConsoleTask;
}

/** The calendar colour of a task: a done task counts as filed (the prototype's donut). */
export function taskSt(stage: TaskStage, due: string, today: string): CSt {
  if (stage === 'completed') return 'f';
  const d = daysBetween(today, due);
  return d < 0 ? 'o' : d <= 6 ? 'd' : 'u';
}

export const taskHint = (t: Pick<ConsoleTask, 'startDate' | 'urgency'>, today: string): string => `Starts ${dShort(t.startDate, today)} · ${t.urgency}`;

export function taskRow(t: ConsoleTask, today: string): TRow {
  const due = t.dueDate.slice(0, 10);
  return {
    id: `${TASK_ID_PREFIX}${t.id}`,
    taskId: t.id,
    clientId: t.engagementId,
    clientName: t.companyName,
    due,
    start: t.startDate.slice(0, 10),
    st: taskSt(t.stage, due, today),
    word: t.word,
    stageLabel: t.stageLabel,
    urgency: t.urgency,
    bars: t.urgencyBars,
    name: t.name,
    title: t.title,
    period: t.periodLabel,
    owner: t.owner?.name ?? null,
    deliverable: t.deliverable,
    completedOn: istDay(t.completedAt),
    done: t.stage === 'completed',
    days: daysBetween(today, due),
    hint: taskHint(t, today),
    task: t,
  };
}

/**
 * The FY's tasks as rows: not-applicable rows (`hidden`) are dropped, a task of
 * a client the Stage filter leaves out is dropped, the rest sort by end date.
 */
export function taskRows(tasks: ConsoleTask[], today: string, inScope?: (clientId: string) => boolean): TRow[] {
  return tasks
    .filter((t) => !t.hidden && (!inScope || inScope(t.engagementId)))
    .map((t) => taskRow(t, today))
    .sort((a, b) => a.due.localeCompare(b.due) || a.clientName.localeCompare(b.clientName) || a.title.localeCompare(b.title));
}

export interface TaskFilter {
  company?: string;
  /** YYYY-MM of the end date */
  month?: string;
  done?: boolean;
  /** the register's status filter: a done task is Filed; Due this week / Overdue / Upcoming follow the end date; SBC calendar never */
  status?: StatusFilter;
}
export function filterTasks(tasks: TRow[], f: TaskFilter): TRow[] {
  return tasks.filter(
    (t) =>
      (!f.company || f.company === 'all' || t.clientId === f.company) &&
      (!f.month || t.due.slice(0, 7) === f.month) &&
      (f.done === undefined || t.done === f.done) &&
      (!f.status || matchStatus(t.st, f.status)),
  );
}

/** C-1 / F-1: the counts on the switch, from the lists already filtered to the window in view. */
export function catCounts(rows: ArrayLike<unknown>, tasks: ArrayLike<unknown>): Record<Category, number> {
  return { all: rows.length + tasks.length, statutory: rows.length, 'non-statutory': tasks.length };
}

export function taskItem(t: TRow, withClient: boolean): CalItem {
  return {
    id: t.id,
    due: t.due,
    st: t.st,
    area: null,
    tag: 'Task',
    title: t.title,
    sub: [withClient ? t.clientName : '', t.owner].filter(Boolean).join(' · '),
    kind: 'task',
    hint: t.hint,
    word: t.word,
  };
}

/** Open tasks ending from today to today + n days (the Coming up agenda). */
export function comingUpTasks(tasks: TRow[], today: string, n = 14): TRow[] {
  const end = addDays(today, n);
  return tasks.filter((t) => !t.done && t.due >= today && t.due <= end);
}

export type NextItem = { kind: 'filing'; r: CRow } | { kind: 'task'; t: TRow };
/** C-4: the next deadline is the earlier of the next unfiled filing and the next open task (a filing wins a tie). */
export function nextItem(rows: CRow[], tasks: TRow[], today: string): NextItem | undefined {
  const r = nextDeadline(rows, today);
  const t = tasks.find((x) => !x.done && x.due >= today);
  if (r && (!t || r.due <= t.due)) return { kind: 'filing', r };
  return t ? { kind: 'task', t } : undefined;
}

export interface TaskBar {
  t: TRow;
  /** first and last day of the bar inside the month (1-based) */
  from: number;
  to: number;
  /** the task starts before / ends after this month */
  cutStart: boolean;
  cutEnd: boolean;
}
/** The timeline's non-statutory lane: a bar from the start date to the end date, clipped to the month. */
export function taskBars(tasks: TRow[], monthKey: string): TaskBar[] {
  const first = `${monthKey}-01`;
  const n = monthDays(monthKey);
  const last = `${monthKey}-${String(n).padStart(2, '0')}`;
  return tasks
    .filter((t) => t.start <= last && t.due >= first)
    .map((t) => ({
      t,
      from: t.start < first ? 1 : Number(t.start.slice(8, 10)),
      to: t.due > last ? n : Number(t.due.slice(8, 10)),
      cutStart: t.start < first,
      cutEnd: t.due > last,
    }))
    .sort((a, b) => a.from - b.from || a.to - b.to);
}

/* ================================================================ SBC's master calendar */

export type SSt = 'o' | 'd' | 'u';
export interface SRow {
  id: string;
  due: string;
  act: StatutoryAct;
  tag: string;
  actFull: string;
  area: AreaCode | null;
  title: string;
  name: string;
  period: string | null;
  st: SSt;
  days: number;
  /** clients in view it applies to */
  clients: string[];
}

const ACT_AREA: Record<StatutoryAct, AreaCode | null> = { GST: 'GST', IT: 'IT', TP: 'IT', MCA: 'MCA', FEMA: 'FEMA', 'STPI/SEZ': 'FEMA', LABOUR: 'PAY', RERA: null };
export const actArea = (a: StatutoryAct): AreaCode | null => ACT_AREA[a];
export { ACT_ORDER };

export function sbcStatus(due: string, today: string): SSt {
  const d = daysBetween(today, due);
  return d < 0 ? 'o' : d <= 6 ? 'd' : 'u';
}

/** "Form 141 challan-cum-statement (Jul ’26)" → ["Form 141 challan-cum-statement", "Jul ’26"] (live statutory list). */
export function splitPeriod(title: string): [string, string | null] {
  const m = /\(([^()]+)\)\s*$/.exec(title);
  return m ? [title.replace(/\s*\([^()]+\)\s*$/, '').trim(), m[1]!.trim()] : [title, null];
}

/** Form codes named in a deadline title (branch layout studio's note). */
export function formsIn(title: string): string | null {
  const m = title.match(/\b(?:Form\s+[A-Z0-9][\w.-]*|GSTR-\d+[A-Z]?|ITR-\d+|CMP-\d+|PMT-\d+|ITC-\d+)\b/gi);
  return m?.length ? [...new Set(m)].join(', ') : null;
}

/**
 * The live rule: a picked company sees the deadlines that apply to it; on all
 * companies a firm-wide admin sees the whole calendar and everyone else only
 * the deadlines that apply to at least one client in view.
 */
export function sbcRows(input: { today: string; clients: Array<{ id: string; e?: Engagement }>; company?: string; firmWide?: boolean }): SRow[] {
  const picked = Boolean(input.company && input.company !== 'all');
  const pool = input.clients.filter((c) => c.e && (!picked || c.id === input.company));
  const out: SRow[] = [];
  for (const d of STATUTORY_DEADLINES) {
    const clients = pool.filter((c) => deadlineAppliesTo(d, c.e!)).map((c) => c.id);
    if (!clients.length && (picked || !input.firmWide)) continue;
    const [name, period] = splitPeriod(d.title);
    out.push({
      id: d.id,
      due: d.date,
      act: d.act,
      tag: ACT_META[d.act].label,
      actFull: ACT_META[d.act].full,
      area: ACT_AREA[d.act],
      title: d.title,
      name,
      period,
      st: sbcStatus(d.date, input.today),
      days: daysBetween(input.today, d.date),
      clients,
    });
  }
  return out;
}

export function sbcItem(s: SRow): CalItem {
  return { id: s.id, due: s.due, st: s.st, area: s.area, tag: s.tag, title: s.name, sub: [s.actFull, s.period].filter(Boolean).join(' · '), kind: 'sbc' };
}

export function actCounts(rows: SRow[]): Record<StatutoryAct, number> {
  const n = Object.fromEntries(ACT_ORDER.map((a) => [a, 0])) as Record<StatutoryAct, number>;
  for (const r of rows) n[r.act] += 1;
  return n;
}

/* ================================================================ period matrix (live "Full year" and Quarterly sheets) */

export interface MxRow {
  key: string;
  clientId: string;
  clientName?: string;
  name: string;
  area: AreaCode;
  cells: Array<CRow | null>;
}
export function periodMatrix(rows: CRow[], periods: string[], periodOf: (r: CRow) => string | null, perClient: boolean): MxRow[] {
  const at = new Map(periods.map((p, i) => [p, i]));
  const out = new Map<string, MxRow>();
  for (const r of rows) {
    const key = `${perClient ? r.clientId + '::' : ''}${r.area}::${r.particular}`;
    let m = out.get(key);
    if (!m) {
      m = { key, clientId: r.clientId, clientName: perClient ? r.clientName : undefined, name: r.name, area: r.area, cells: periods.map(() => null) };
      out.set(key, m);
    }
    const p = periodOf(r);
    const i = p ? at.get(p) : undefined;
    if (i !== undefined) m.cells[i] = r;
  }
  return [...out.values()].sort(
    (a, b) => (a.clientName ?? '').localeCompare(b.clientName ?? '') || AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area) || a.name.localeCompare(b.name),
  );
}
export const quarterOf = (fy: number) => (r: CRow): string | null => quarterForMonthKey(r.due.slice(0, 7), fy)?.key ?? null;

/* ================================================================ words */

/** "Northwind, Orchid Lane and Juniper" / "A, B, C and 2 more". */
export function listNames(names: string[], max = 3): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

/** The one-line banner over rows that come from SBC's calendar. */
export function fallbackLine(cl: BookClient[], fyLabel: string): string {
  if (!cl.length) return '';
  const pre = cl.filter((c) => c.fallback === 'pre').length;
  const why = pre === cl.length ? 'they are not incorporated yet' : pre === 0 ? 'SBC has not generated their register yet' : 'they are not incorporated yet, or SBC has not generated their register yet';
  const one = cl.length === 1;
  return `${listNames(cl.map((c) => c.short))} ${one ? 'has' : 'have'} no filings on the register for ${fyLabel}${one ? (pre ? ' (not incorporated yet)' : ' (register not generated yet)') : ` (${why})`}, so ${one ? 'its' : 'their'} rows come from SBC’s compliance calendar, marked SBC calendar: no proof, reminder or window until SBC adds them to the register.`;
}

/** "1–20 Oct", "28 Sep – 5 Oct", "28 Dec 2026 – 4 Jan 2027". */
export function winShort(w: { from: string; to: string }, today: string): string {
  if (w.from.slice(0, 7) === w.to.slice(0, 7)) {
    const tail = dShort(w.to, today).replace(/^\d+\s/, '');
    return `${Number(w.from.slice(8, 10))}–${Number(w.to.slice(8, 10))} ${tail}`;
  }
  if (w.from.slice(0, 4) === w.to.slice(0, 4) && w.to.slice(0, 4) === today.slice(0, 4)) return `${dShort(w.from, today)} – ${dShort(w.to, today)}`;
  const y = (s: string) => `${dShort(s, '0000-00-00')}`;
  return `${y(w.from)} – ${y(w.to)}`;
}

/** "Due today", "Due in 3 days", "5 days late", "Filed 12 Oct". */
export function whenText(r: { st: CSt; days: number; filedOn?: string; due: string }, today: string): string {
  if (r.filedOn) return `Filed ${dShort(r.filedOn, today)}`;
  if (r.days < 0) return r.st === 'c' ? `Was due ${dShort(r.due, today)}` : `${-r.days} day${r.days === -1 ? '' : 's'} late`;
  if (r.days === 0) return 'Due today';
  if (r.days === 1) return 'Due tomorrow';
  return `Due in ${r.days} days`;
}

/* ================================================================ export */

export function registerCsv(rows: CRow[]): string {
  const head = ['Due date', 'Client', 'Area', 'Filing', 'Period', 'Frequency', 'Authority', 'Status', 'Filed on', 'Window', 'ARN', 'Tax paid (INR)', 'Proof files', 'Source'];
  const lines = rows.map((r) =>
    [
      r.due,
      r.clientName,
      AREA_LABEL[r.area],
      r.name,
      r.period,
      r.freqLabel,
      r.authorityName,
      C_LABEL[r.st],
      r.filedOn ?? '',
      r.window ? `${r.window.from} to ${r.window.to}` : '',
      r.portal?.acknowledgementNo ?? '',
      r.portal?.amountPaid ?? '',
      r.cal ? '' : r.proofs,
      r.cal ? 'SBC calendar' : 'Register',
    ]
      .map(csvEscape)
      .join(','),
  );
  return [head.join(','), ...lines].join('\r\n') + '\r\n';
}

/** A register row as the portal shape `filingsIcs` takes (the portal read when it arrived). */
export function asPortal(r: CRow): PortalFiling {
  if (r.portal) return r.portal;
  return {
    id: r.id,
    engagementId: r.clientId,
    companyName: r.clientName,
    particular: r.particular,
    name: r.name,
    area: r.area,
    authority: r.authority,
    authorityName: r.authorityName,
    frequency: r.freq,
    freqLabel: r.freqLabel,
    dueDate: r.due,
    filedOn: r.filedOn ?? null,
    period: r.period || '—',
    periodLong: null,
    fyLabel: null,
    rawStatus: r.reg?.rawStatus ?? '',
    windowFrom: r.window?.from ?? null,
    windowTo: r.window?.to ?? null,
    penaltyRisk: '',
    ownerName: null,
    acknowledgementNo: null,
    amountPaid: null,
    filedByName: null,
    dataReceivedOn: null,
    preparingSince: null,
    draftDueOn: null,
    approvalDueOn: null,
    approvedOn: null,
    proofCount: r.proofs,
    reminderOn: r.reminderOn ?? null,
  };
}
