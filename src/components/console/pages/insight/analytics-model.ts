/**
 * ANALYTICS — the pure half. Every number comes from real rows:
 *
 *   kpis      the live view's four numbers, computed exactly as live
 *             (src/views/admin/Analytics.tsx): every checklist item of every
 *             project, not-applicable skipped; status completed / awaiting-client
 *             / overdue counted as stored
 *   trends    month-end series from real timestamps only: projects by the month
 *             each was set up (`createdAt`), steps done by their done date
 *             (`completedOn`, else `deliveredToClientAt`). Waiting and Overdue
 *             have no history in the database, so they get no trend line
 *   filings   per month, from the register (`/api/filings`): filings due that
 *             month and settled (filed, or past due and still open) — filed on
 *             time, filed late, still open; the on-time rate and the average days
 *             past due (open filings count the days so far)
 *   leads     (manager) per project lead, the steps and filings their clients
 *             closed in the last 14 days and how many met their due date
 *
 * No React, no fetch.
 */
import { checklist } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { FilingRow } from '@/lib/filings';
import { MON } from '@/components/portal/dates';
import { filingName, type TItem, type TodayModel } from '../today/model';
import { istDayOf } from './fmt';

export type Range = 6 | 12;

export interface MonthCol {
  key: string;
  short: string;
  label: string;
  start: string;
  end: string;
}

/** The last `n` calendar months, oldest first, ending with the month of `today`. */
export function monthsBack(today: string, n: number): MonthCol[] {
  const idx0 = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;
  return Array.from({ length: n }, (_, i) => {
    const idx = idx0 - (n - 1 - i);
    const y = Math.floor(idx / 12);
    const m = idx % 12;
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return { key, short: MON[m]!, label: `${MON[m]} ${y}`, start: `${key}-01`, end: `${key}-${String(last).padStart(2, '0')}` };
  });
}

const daysFrom = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

type Slice = { status?: string; completedOn?: string; deliveredToClientAt?: string };
export type StateFor = (e: Engagement) => Record<string, Slice | undefined> | undefined;

export interface StepRef {
  e: Engagement;
  itemId: string;
  title: string;
  doneOn?: string;
}

export interface ProjectSteps {
  e: Engagement;
  done: number;
  total: number;
  pct: number;
}

export interface Kpis {
  projects: number;
  stepsDone: number;
  stepsTotal: number;
  pct: number;
  waiting: StepRef[];
  overdue: StepRef[];
  byProject: ProjectSteps[];
  /** completed steps with a done date (newest first) */
  dated: StepRef[];
  undated: number;
}

/** The live view's KPI loop, keeping the rows behind each count. */
export function buildKpis(engagements: Engagement[], stateFor: StateFor): Kpis {
  let stepsDone = 0;
  let stepsTotal = 0;
  let undated = 0;
  const waiting: StepRef[] = [];
  const overdue: StepRef[] = [];
  const dated: StepRef[] = [];
  const byProject: ProjectSteps[] = [];
  for (const e of engagements) {
    const state = stateFor(e) ?? {};
    let done = 0;
    let total = 0;
    for (const item of checklist) {
      const sl = state[item.id];
      const s = sl?.status ?? 'not-started';
      if (s === 'not-applicable') continue;
      total += 1;
      if (s === 'completed') {
        done += 1;
        const on = istDayOf(sl?.completedOn) ?? istDayOf(sl?.deliveredToClientAt);
        if (on) dated.push({ e, itemId: item.id, title: item.title, doneOn: on });
        else undated += 1;
      }
      if (s === 'awaiting-client') waiting.push({ e, itemId: item.id, title: item.title });
      if (s === 'overdue') overdue.push({ e, itemId: item.id, title: item.title });
    }
    stepsDone += done;
    stepsTotal += total;
    byProject.push({ e, done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 });
  }
  dated.sort((a, b) => b.doneOn!.localeCompare(a.doneOn!));
  byProject.sort((a, b) => b.pct - a.pct || a.e.companyName.localeCompare(b.e.companyName));
  return {
    projects: engagements.length,
    stepsDone,
    stepsTotal,
    pct: stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0,
    waiting,
    overdue,
    byProject,
    dated,
    undated,
  };
}

export interface Trends {
  /** projects set up by each month end (oldest first) */
  projects: number[];
  /** projects set up inside the range */
  added: Engagement[];
  /** dated done steps by each month end */
  steps: number[];
  /** steps done inside the range */
  doneInRange: StepRef[];
}

export function buildTrends(engagements: Engagement[], k: Kpis, months: MonthCol[]): Trends {
  const start = months[0]?.start ?? '';
  const created = engagements.map((e) => ({ e, on: istDayOf(e.createdAt) }));
  return {
    projects: months.map((m) => created.filter((c) => !c.on || c.on <= m.end).length),
    added: created.filter((c) => !!c.on && c.on >= start).map((c) => c.e),
    steps: months.map((m) => k.dated.filter((d) => d.doneOn! <= m.end).length),
    doneInRange: k.dated.filter((d) => d.doneOn! >= start),
  };
}

export type FSettled = 'f' | 'l' | 'o';
export interface FilingCell {
  row: FilingRow;
  name: string;
  due: string;
  filedOn?: string;
  st: FSettled;
  /** days past due (0 when on time; open ones count to today) */
  lateDays: number;
}
export interface FilingMonth extends MonthCol {
  rows: FilingCell[];
  onTime: number;
  late: number;
  open: number;
  /** % filed on time, null when nothing was due */
  rate: number | null;
  /** average days past due, one decimal; null when nothing was due */
  delay: number | null;
}

export function filingMonths(rows: FilingRow[], months: MonthCol[], today: string): FilingMonth[] {
  const by = new Map<string, FilingCell[]>(months.map((m) => [m.key, []]));
  for (const row of rows) {
    const due = row.dueDate?.slice(0, 10) ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) continue;
    const list = by.get(due.slice(0, 7));
    if (!list) continue;
    const filed = istDayOf(row.filedOn);
    if (filed) {
      const late = Math.max(0, daysFrom(due, filed));
      list.push({ row, name: filingName(row), due, filedOn: filed, st: late > 0 ? 'l' : 'f', lateDays: late });
    } else if (due < today) {
      list.push({ row, name: filingName(row), due, st: 'o', lateDays: daysFrom(due, today) });
    }
    // unfiled and not yet past due: not settled, left out
  }
  return months.map((m) => {
    const list = (by.get(m.key) ?? []).sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
    const n = list.length;
    const onTime = list.filter((x) => x.st === 'f').length;
    return {
      ...m,
      rows: list,
      onTime,
      late: list.filter((x) => x.st === 'l').length,
      open: list.filter((x) => x.st === 'o').length,
      rate: n ? Math.round((onTime / n) * 100) : null,
      delay: n ? Math.round((list.reduce((s, x) => s + x.lateDays, 0) / n) * 10) / 10 : null,
    };
  });
}

/* ---------------------------------------------------------------- by project lead (manager) */

export interface LeadDone {
  id: string;
  kind: 'step' | 'filing';
  title: string;
  clientId: string;
  on: string;
  due?: string;
  /** undefined when it had no due date */
  onTime?: boolean;
  stepId?: string;
}
export interface LeadCard {
  key: string;
  name: string;
  initials: string;
  done: LeadDone[];
  open: TItem[];
  overdue: TItem[];
  dated: number;
  onTime: number;
  rate: number | null;
}

/** Per lead: what their clients (in the Stage filter) closed in the last `days` days, plus Today's open items. */
export function leadCards(m: Pick<TodayModel, 'leads' | 'clients'>, today: string, days = 14): LeadCard[] {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 864e5).toISOString().slice(0, 10);
  const within = (d?: string) => !!d && d >= from && d <= today;
  return m.leads.map((l) => {
    const done: LeadDone[] = [];
    for (const c of m.clients) {
      if (c.leadKey !== l.key) continue;
      for (const s of c.model.steps) {
        if (s.kind !== 'done' || !within(s.doneOn)) continue;
        done.push({ id: `s:${c.id}:${s.id}`, kind: 'step', title: s.title, clientId: c.id, on: s.doneOn!, due: s.due, onTime: s.due ? s.doneOn! <= s.due : undefined, stepId: s.id });
      }
      for (const f of c.filings) {
        if ((f.st !== 'f' && f.st !== 'l') || !within(f.filedOn)) continue;
        done.push({ id: `f:${f.id}`, kind: 'filing', title: f.name, clientId: c.id, on: f.filedOn!, due: f.due, onTime: f.st === 'f' });
      }
    }
    done.sort((a, b) => b.on.localeCompare(a.on));
    const dated = done.filter((d) => d.onTime !== undefined);
    const onTime = dated.filter((d) => d.onTime).length;
    return {
      key: l.key,
      name: l.name,
      initials: l.initials,
      done,
      open: l.open,
      overdue: l.open.filter((t) => t.st === 'over'),
      dated: dated.length,
      onTime,
      rate: dated.length ? Math.round((onTime / dated.length) * 100) : null,
    };
  });
}

/** Ring colour for an on-time rate: 90%+ green, 80–89% amber, below red. */
export const rateColor = (r: number): string => (r >= 90 ? 'var(--mx-ok)' : r >= 80 ? 'var(--due)' : 'var(--over)');
