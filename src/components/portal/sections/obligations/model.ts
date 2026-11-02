/**
 * Obligations section — pure helpers (no React, no fetch) in the portal's wording.
 *
 * The data models are Farhath's (src/components/client-portal/pages/compliances/):
 * `tasks.ts` (the six status words, the end-week groups, urgency bars) and
 * `obligations.ts` (the register rows grouped by obligation). This file only adds
 * what the Northwind portal needs on top: pill kinds for the six words, the
 * "Due in N days" line, badge and summary counts, and the period order of an
 * obligation's card.
 */
import { statusOf, type CompStatus, type PortalFiling } from '@/lib/client-portal/compliances';
import type { Obligation } from '@/components/client-portal/pages/compliances/obligations';
import { taskWord, type ClientTask, type StatusWord } from '@/components/client-portal/pages/compliances/tasks';
import type { DetailReminder, DetailStep } from '@/components/client-portal/pages/compliances/task-api';
import type { IconName } from '../../ui';
import { daysTo, fmt, fmtStamp } from '../../dates';

export type PillKind = 'over' | 'due' | 'done' | 'ok' | 'up' | 'mut' | 'na';

/** The six task words (R-13) as the prototype's pill classes and icons. */
export const WORD_PILL: Record<StatusWord, PillKind> = {
  Overdue: 'over',
  'Due soon': 'due',
  Waiting: 'due',
  'In progress': 'up',
  'Not started': 'mut',
  Done: 'done',
};
export const WORD_ICON: Record<StatusWord, IconName> = {
  Overdue: 'alert',
  'Due soon': 'clock',
  Waiting: 'clock',
  'In progress': 'clock',
  'Not started': 'clock',
  Done: 'check',
};
export const isWord = (w: string | null | undefined): w is StatusWord => Boolean(w) && w! in WORD_PILL;

/** An obligation's worst open state, in words: "Up to date" when nothing is open. */
export const OBLIGATION_WORD: Record<CompStatus, string> = { over: 'Overdue', due: 'Due soon', up: 'Upcoming', ok: 'Up to date' };

/** Frequency group labels, in the register's order (his FREQ_ORDER plus "Other"). */
export const FREQ_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'half-yearly': 'Half-yearly',
  annual: 'Annual',
  'one-time': 'One-time',
  other: 'Other',
};

/** "Due in 4 days", "Due today", "3 days overdue", or `doneWord` once done. */
export function dueWords(due: string, today: string, done: boolean, doneWord = 'Done'): string {
  if (done) return doneWord;
  const n = daysTo(due, today);
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`;
  if (n === 0) return 'Due today';
  return `Due in ${n} day${n === 1 ? '' : 's'}`;
}

/** "14 Oct" from an ISO day or a timestamp; "—" when there is none. */
export function whenText(v: string | null | undefined): string {
  if (!v) return '—';
  return v.includes('T') ? fmtStamp(v) || '—' : fmt(v.slice(0, 10));
}

/** The nav badge: overdue register rows plus overdue tasks. */
export function overdueCount(rows: PortalFiling[], tasks: ClientTask[], today: string): number {
  const f = rows.filter((r) => statusOf(r, today) === 'over').length;
  const t = tasks.filter((x) => taskWord(x, today) === 'Overdue').length;
  return f + t;
}

/** "2 overdue · 1 due soon · 4 upcoming" for the obligations shown; '' when there are none. */
export function statSummary(obligations: Obligation[]): string {
  const n = (s: CompStatus) => obligations.filter((o) => o.status === s).length;
  return [
    n('over') ? `${n('over')} overdue` : '',
    n('due') ? `${n('due')} due soon` : '',
    n('up') ? `${n('up')} upcoming` : '',
    n('ok') ? `${n('ok')} up to date` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "1 overdue · 2 in progress · 3 done" for the tasks shown, in the six words; '' when none. */
export function taskSummary(tasks: ClientTask[], today: string): string {
  const order: StatusWord[] = ['Overdue', 'Due soon', 'Waiting', 'In progress', 'Not started', 'Done'];
  return order
    .map((w) => {
      const n = tasks.filter((t) => taskWord(t, today) === w).length;
      return n ? `${n} ${w.toLowerCase()}` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

/** The periods on an obligation's card: open ones first (soonest due), then filed ones, newest first. */
export function cardPeriods(o: Pick<Obligation, 'instances'>): PortalFiling[] {
  const open = o.instances.filter((f) => !f.filedOn).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const filed = o.instances.filter((f) => f.filedOn).sort((a, b) => (b.filedOn ?? '').localeCompare(a.filedOn ?? '') || b.dueDate.localeCompare(a.dueDate));
  return [...open, ...filed];
}

/** The route answered 404: a firm-only task, or another client's. */
export function isNotFound(e: unknown): boolean {
  return Boolean(e) && typeof e === 'object' && (e as { status?: number }).status === 404;
}

/** A detail step's state as the prototype's `.nd` class. */
export const STEP_ND: Record<DetailStep['state'], 'done' | 'prog' | 'up'> = { done: 'done', now: 'prog', next: 'up' };

export const REMINDER_STATE: Record<DetailReminder['state'], string> = {
  sent: 'Sent',
  acknowledged: 'Read',
  scheduled: 'Scheduled',
  skipped: 'Skipped',
  blocked: 'Not set up',
};

/** First name for a narrow column: "Priya Raman" → "Priya". */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;
