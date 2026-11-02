/**
 * OBLIGATIONS (statutory + non-statutory) — the pure lists behind the console's
 * Obligations pages. No React, no fetch.
 *
 *   statutory      the register rows the book already holds (`CRow`, one FY),
 *                  regrouped by obligation the way the live ObligationsView does:
 *                  one band per obligation = the period that needs attention
 *                  (earliest unfiled due date, else the latest), its client rows
 *                  under it, "n of m filed" counting that one period.
 *   non-statutory  the task rows `GET /api/compliances/tasks` returns (the server
 *                  computes `word` and `week`), grouped by end-date week.
 *
 * Status vocabulary for both halves is the API's six words (R-13): Not started,
 * In progress, Waiting, Due soon, Overdue, Done.
 */
import type { TaskRowDto } from '@/views/compliances/tasks/api';
import type { WorkflowStage } from '@/views/compliances/tasks/task-model';
import { addDays, daysBetween } from '../today/model';
import type { CRow, CSt } from './model';

/* ================================================================ vocabulary */

export type StatusWord = 'Not started' | 'In progress' | 'Waiting' | 'Due soon' | 'Overdue' | 'Done';
export const WORDS: StatusWord[] = ['Overdue', 'Due soon', 'In progress', 'Waiting', 'Not started', 'Done'];
/** `.pill` class per word (README: red overdue, amber due soon, green done, accent current). */
export const WORD_PILL: Record<StatusWord, string> = { 'Not started': 'na', 'In progress': 'up', Waiting: 'mut', 'Due soon': 'due', Overdue: 'over', Done: 'ok' };
export const WORD_TIP: Record<StatusWord, string> = {
  'Not started': 'Nobody has started it yet',
  'In progress': 'Being worked on, in review, or back for rework',
  Waiting: 'Waiting for the client',
  'Due soon': 'Not started and inside its reminder window',
  Overdue: 'Past its due date and not done',
  Done: 'Completed, or filed',
};

export type Cat = 'stat' | 'ns' | 'all';
export const parseCat = (v?: string | null): Cat => (v === 'ns' || v === 'all' ? v : 'stat');
export const CAT_LABEL: Record<Cat, string> = { stat: 'Statutory', ns: 'Non-statutory', all: 'All' };

/** The number strip (live `FilterStrip`): the keys stay, the labels follow the category (S-8). */
export type StripKey = '' | 'overdue' | 'soon' | 'waiting' | 'done' | 'none';
export const STRIP_KEYS: Array<Exclude<StripKey, ''>> = ['overdue', 'soon', 'waiting', 'done', 'none'];
export const parseStrip = (v?: string | null): StripKey => (STRIP_KEYS.includes(v as never) ? (v as StripKey) : '');
export const STRIP_LABELS: Record<Cat, Record<Exclude<StripKey, ''>, string>> = {
  stat: { overdue: 'Overdue', soon: 'Due in 15 days', waiting: 'Waiting on client', done: 'Filed', none: 'Not started' },
  ns: { overdue: 'Overdue', soon: 'Due this week', waiting: 'Waiting on client', done: 'Done', none: 'Not started' },
  all: { overdue: 'Overdue', soon: 'Due soon', waiting: 'Waiting on client', done: 'Done', none: 'Not started' },
};
export const STRIP_COLOR: Record<Exclude<StripKey, ''>, string> = {
  overdue: 'var(--over)',
  soon: 'var(--due)',
  waiting: 'var(--mx-wait)',
  done: 'var(--mx-ok)',
  none: 'var(--mx-none)',
};

export type GroupBy = 'filing' | 'frequency' | 'law';
export const parseGroupBy = (v?: string | null): GroupBy => (v === 'frequency' || v === 'law' ? v : 'filing');
export const GROUP_LABEL: Record<GroupBy, string> = { filing: 'By filing', frequency: 'By frequency', law: 'By law' };

/** "Due in the next 15 days" (owner decision for the Obligations rail). */
export const SOON_DAYS = 15;

/* ================================================================ statutory */

export interface ObRow {
  /** the instance id */
  key: string;
  r: CRow;
  word: StatusWord;
  /** latest filed date of this obligation for this client, any period in view */
  lastFiled: string | null;
  /** earliest unfiled due date of this obligation for this client */
  nextDue: string | null;
  /** not filed, no data received, late or due within 15 days */
  waiting: boolean;
}

export interface ObGroup {
  obligationId: string;
  name: string;
  area: CRow['area'];
  authority: string;
  freq: string;
  freqLabel: string;
  /** the band's due date */
  dueDate: string;
  /** worst status of the band's rows */
  st: CSt;
  filed: number;
  total: number;
  rows: ObRow[];
  /** every instance of the obligation in view, by due date */
  instances: CRow[];
}

/** The six-word reading of a register row (live `filingWord`). */
export function statWord(r: Pick<CRow, 'filedOn' | 'st' | 'reg'>): StatusWord {
  if (r.filedOn) return 'Done';
  if (r.st === 'o') return 'Overdue';
  if (r.st === 'd') return 'Due soon';
  if (r.reg?.rawStatus === 'in-progress') return 'In progress';
  return 'Not started';
}

/** Unfiled and due today or within the next 15 days. */
export const dueWithinSoon = (r: Pick<CRow, 'filedOn' | 'days'>): boolean => !r.filedOn && r.days >= 0 && r.days <= SOON_DAYS;

/** Live rule: not filed, facts loaded, no "data received" date, and late or due within 15 days. */
export const waitingOnClient = (r: Pick<CRow, 'filedOn' | 'days' | 'portal'>): boolean =>
  !r.filedOn && Boolean(r.portal) && !r.portal!.dataReceivedOn && r.days <= SOON_DAYS;

const WORST: CSt[] = ['o', 'd', 'u', 'c', 'l', 'f'];

export function groupObligations(rows: CRow[]): ObGroup[] {
  const by = new Map<string, CRow[]>();
  for (const r of rows) {
    const id = r.reg?.obligationId;
    if (!id) continue; // SBC calendar lines are not on a register yet
    const list = by.get(id) ?? [];
    list.push(r);
    by.set(id, list);
  }
  const out: ObGroup[] = [];
  for (const [obligationId, list] of by) {
    const sorted = [...list].sort((a, b) => a.due.localeCompare(b.due) || a.clientName.localeCompare(b.clientName));
    const unfiled = sorted.filter((r) => !r.filedOn);
    const dueDate = unfiled[0]?.due ?? sorted[sorted.length - 1]!.due;
    const lastFiled = new Map<string, string>();
    const nextDue = new Map<string, string>();
    for (const r of sorted) {
      if (r.filedOn) {
        const prev = lastFiled.get(r.clientId);
        if (!prev || r.filedOn > prev) lastFiled.set(r.clientId, r.filedOn);
      } else if (!nextDue.has(r.clientId)) nextDue.set(r.clientId, r.due);
    }
    const band = sorted
      .filter((r) => r.due === dueDate)
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
      .map(
        (r): ObRow => ({
          key: r.id,
          r,
          word: statWord(r),
          lastFiled: lastFiled.get(r.clientId) ?? null,
          nextDue: nextDue.get(r.clientId) ?? null,
          waiting: waitingOnClient(r),
        }),
      );
    const first = sorted[0]!;
    const sts = new Set(band.map((x) => x.r.st));
    out.push({
      obligationId,
      name: first.name,
      area: first.area,
      authority: first.authorityName,
      freq: first.freq,
      freqLabel: first.freqLabel,
      dueDate,
      st: WORST.find((s) => sts.has(s)) ?? 'u',
      filed: band.filter((x) => Boolean(x.r.filedOn)).length,
      total: band.length,
      rows: band,
      instances: sorted,
    });
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}

export function statMatches(x: ObRow, f: StripKey): boolean {
  switch (f) {
    case '':
      return true;
    case 'overdue':
      return x.r.st === 'o';
    case 'soon':
      return dueWithinSoon(x.r);
    case 'waiting':
      return x.waiting;
    case 'done':
      return Boolean(x.r.filedOn);
    case 'none':
      return x.word === 'Not started';
  }
}

/** The live register's frequency buckets for "By frequency". */
export const FREQ_BUCKETS: Array<[string, string]> = [
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['half-yearly', 'Half-yearly'],
  ['annual', 'Annual'],
  ['one-time', 'One-time'],
];
export const freqBucket = (freq: string): string => freq.trim().toLowerCase();

export interface FlowCounts {
  data: number;
  prepared: number;
  filed: number;
  acknowledged: number;
}
/** Progress flow of a set of instances (live `flowCounts`): rows without facts count only once filed. */
export function flowCounts(rows: CRow[]): FlowCounts {
  const out: FlowCounts = { data: 0, prepared: 0, filed: 0, acknowledged: 0 };
  for (const r of rows) {
    if (r.cal) continue;
    const p = r.portal;
    if (r.filedOn) {
      if (p?.acknowledgementNo?.trim()) out.acknowledged += 1;
      else out.filed += 1;
    } else if (p) {
      if (p.dataReceivedOn) out.prepared += 1;
      else out.data += 1;
    }
  }
  return out;
}

/* ================================================================ non-statutory */

export type WeekGroup = 'This week' | 'Next week' | 'Later' | 'Done';
export const WEEK_GROUPS: WeekGroup[] = ['This week', 'Next week', 'Later', 'Done'];
export const WEEK_COLOR: Record<WeekGroup, string> = { 'This week': 'var(--due)', 'Next week': 'var(--ice)', Later: 'var(--mx-none)', Done: 'var(--mx-ok)' };

export type TaskLike = Pick<TaskRowDto, 'id' | 'week' | 'dueDate' | 'title' | 'word' | 'stage' | 'hidden' | 'completedAt'>;

/** S-3: rows grouped by the server's end-date week; Done shows the latest first. */
export function groupTasksByWeek<T extends TaskLike>(tasks: T[]): Array<{ key: WeekGroup; label: WeekGroup; rows: T[] }> {
  const sorted = [...tasks].filter((t) => !t.hidden).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
  return WEEK_GROUPS.map((g) => {
    const rows = sorted.filter((t) => t.week === g);
    return { key: g, label: g, rows: g === 'Done' ? rows.sort((a, b) => (b.completedAt ?? b.dueDate).localeCompare(a.completedAt ?? a.dueDate)) : rows };
  });
}

/** The strip keys on task rows, from the server's word and week (S-8). */
export function taskMatches(t: Pick<TaskRowDto, 'word' | 'week' | 'stage'>, f: StripKey): boolean {
  switch (f) {
    case '':
      return true;
    case 'overdue':
      return t.word === 'Overdue';
    case 'soon':
      return t.word !== 'Overdue' && t.word !== 'Done' && t.week === 'This week';
    case 'waiting':
      return t.word === 'Waiting';
    case 'done':
      return t.word === 'Done';
    case 'none':
      return (t.stage === 'not-started' || t.stage === 'ready') && t.word !== 'Overdue';
  }
}

export const URGENCIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type Urgency = (typeof URGENCIES)[number];
export const URGENCY_BARS: Record<Urgency, 1 | 2 | 3 | 4> = { Low: 1, Medium: 2, High: 3, Critical: 4 };
export type Visibility = 'firm' | 'client' | 'both';
export const VIS_LABEL: Record<Visibility, string> = { firm: 'Firm', client: 'Client', both: 'Both' };
export const VIS_TIP: Record<Visibility, string> = { firm: 'Visible to the firm only', client: 'Visible to the client', both: 'Visible to the firm and the client' };

/** The task-list filters the API offers (`GET /api/compliances/tasks`), kept in the URL. */
export interface TaskFilters {
  engagementId?: string;
  status?: StatusWord | '';
  urgency?: Urgency | '';
  visibility?: Visibility | '';
  mine?: boolean;
}
export function parseTaskFilters(get: (k: string) => string | null, engagementId?: string): TaskFilters {
  const status = get('status');
  const urgency = get('urgency');
  const vis = get('vis');
  return {
    engagementId,
    status: WORDS.includes(status as StatusWord) ? (status as StatusWord) : '',
    urgency: URGENCIES.includes(urgency as Urgency) ? (urgency as Urgency) : '',
    visibility: vis === 'firm' || vis === 'client' || vis === 'both' ? vis : '',
    mine: get('mine') === '1',
  };
}
export function taskQuery(f: TaskFilters): string {
  const p = new URLSearchParams();
  if (f.engagementId) p.set('engagementId', f.engagementId);
  if (f.status) p.set('status', f.status);
  if (f.urgency) p.set('urgency', f.urgency);
  if (f.visibility) p.set('visibility', f.visibility);
  if (f.mine) p.set('mine', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
}
export const taskFiltersOn = (f: TaskFilters): boolean => Boolean(f.status || f.urgency || f.visibility || f.mine);

/* ================================================================ stages */

/** Stages a lead may set by hand; closing and "not applicable" are for admin and manager. */
const LEAD_TASK_STAGES: WorkflowStage[] = ['not-started', 'ready', 'in-progress', 'waiting'];
const MANAGER_TASK_STAGES: WorkflowStage[] = [...LEAD_TASK_STAGES, 'completed', 'not-applicable'];
export function taskStageChoices(current: WorkflowStage, manager: boolean): WorkflowStage[] {
  const base = manager ? MANAGER_TASK_STAGES : LEAD_TASK_STAGES;
  return base.includes(current) ? base : [current, ...base];
}
/** Statutory: never Completed (filing marks it), Not applicable for admin and manager only. */
export function statStageChoices(current: WorkflowStage, manager: boolean): WorkflowStage[] {
  const base: WorkflowStage[] = ['not-started', 'ready', 'in-progress', 'waiting', ...(manager ? (['not-applicable'] as WorkflowStage[]) : [])];
  return base.includes(current) ? base : [current, ...base];
}

/* ================================================================ reminders, words */

export const REMINDER_WORD: Record<string, string> = { sent: 'Sent', acknowledged: 'Acknowledged', scheduled: 'Scheduled', skipped: 'Skipped', blocked: 'On hold' };
export const DAY_CHOICES = [1, 2, 3, 5, 7, 10, 15, 20, 30];

/** DR-22: "Reminders are on hold until these are set: owner, activity not confirmed." */
export function blockedLine(gaps: readonly string[]): string | null {
  return gaps.length ? `Reminders are on hold until these are set: ${gaps.join(', ')}.` : null;
}

/** "3 days late", "Due today", "Due tomorrow", "Due in 4 days". */
export function dueWords(days: number): string {
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} late`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

/** "Starts in 3 days", "Started 2 days ago", "Starts today" (DR-06). */
export function startWords(daysToStart: number): string {
  if (daysToStart > 1) return `Starts in ${daysToStart} days`;
  if (daysToStart === 1) return 'Starts tomorrow';
  if (daysToStart === 0) return 'Starts today';
  return `Started ${-daysToStart} day${daysToStart === -1 ? '' : 's'} ago`;
}

/** Unfiled register rows from today to today + n days, soonest first. */
export function soonRows(rows: CRow[], today: string, n = SOON_DAYS): CRow[] {
  const end = addDays(today, n);
  return rows.filter((r) => !r.cal && !r.filedOn && r.due >= today && r.due <= end).sort((a, b) => a.due.localeCompare(b.due));
}

/** Days from a to b (b − a). */
export const days = daysBetween;

/* ================================================================ routes (the bell links of COMPLIANCE-API.md section 7) */

export const hrefs = (base: string) => ({
  list: (q = '') => `${base}/compliances/obligations${q ? `?${q}` : ''}`,
  obligation: (obligationId: string) => `${base}/compliances/obligations/${encodeURIComponent(obligationId)}`,
  statutory: (obligationId: string, instanceId: string) => `${base}/compliances/obligations/${encodeURIComponent(obligationId)}/${encodeURIComponent(instanceId)}`,
  task: (taskId: string) => `${base}/compliances/obligations/tasks/${encodeURIComponent(taskId)}`,
});
