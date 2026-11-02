/**
 * Non-statutory tasks on the portal's Calendar and Filings sections (Farhath's
 * compliance-client spec, rows C-1..C-4 and F-1..F-3). Pure: no React, no fetch.
 *
 * The task model itself (`taskAsRow`, `isTaskRow`, `taskWord`, `taskHint`,
 * `showStat` / `showTasks`) is imported from his library folder; this file adds
 * only what the one-page portal needs on top: the `?cat=` search parameter, the
 * merge of register rows and task rows under the category switch, the pill kind
 * of the six status words, and the hover text of a task marker.
 */
import { fyStartOfMonth, type PortalFiling } from '@/lib/client-portal/compliances';
import { isTaskRow, showStat, showTasks, taskHint, taskWord, type CalRow, type Category, type StatusWord, type TaskRow } from '@/components/client-portal/pages/compliances/tasks';

export type { CalRow, Category, TaskRow };

/* ------------------------------------------------------------------ ?cat= */

/** C-1 / F-1: the category kept in the URL (`All` when absent or unknown). */
export function readCat(search: string): Category {
  const v = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('cat');
  return v === 'statutory' || v === 'non-statutory' ? v : 'all';
}

/** The search string with `cat` set (dropped for `All`), every other parameter kept. */
export function catSearch(search: string, cat: Category): string {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (cat === 'all') p.delete('cat');
  else p.set('cat', cat);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/* ------------------------------------------------------------------ rows */

/**
 * C-4: the rows a view draws. Statutory rows show unless the switch is on
 * Non-statutory; task rows show unless it is on Statutory, and never under an
 * area pick (a task has no regulator).
 */
export function mergeRows<T extends PortalFiling>(stat: T[], tasks: TaskRow[], cat: Category, law: string): Array<T | TaskRow> {
  return [...(showStat(cat) ? stat : []), ...(showTasks(cat) && law === 'all' ? tasks : [])];
}

/** Task rows whose end date falls in the financial year starting in April of `fy`. */
export function tasksInFy(tasks: TaskRow[], fy: number): TaskRow[] {
  return tasks.filter((r) => fyStartOfMonth(r.dueDate.slice(0, 7)) === fy);
}

/** The statutory rows of a merged list (the law counts, the badge, the export). */
export const statOnly = <T extends PortalFiling>(rows: Array<T | TaskRow>): T[] => rows.filter((r) => !isTaskRow(r)) as T[];

/** The counts on the category switch: statutory rows and task rows of the window. */
export function catCounts(stat: PortalFiling[], tasks: TaskRow[]): { stat: number; ns: number } {
  return { stat: stat.length, ns: tasks.length };
}

/* ------------------------------------------------------------------ words */

export type PillKind = 'over' | 'due' | 'done' | 'up' | 'mut';

/** The six status words as prototype pill classes: red for late, amber when it needs you. */
export const WORD_PILL: Record<StatusWord, PillKind> = {
  Overdue: 'over',
  'Due soon': 'due',
  Waiting: 'due',
  'In progress': 'up',
  'Not started': 'mut',
  Done: 'done',
};

/** C-3 hover text of a task marker: "MIS report · Starts 10 Oct · High · In progress". */
export function taskTitle(r: TaskRow, today: string): string {
  return `${r.name} · ${taskHint(r.task)} · ${taskWord(r.task, today)}`;
}

/** C-4: the Next deadline card's second line for a task. */
export function taskNextLine(r: TaskRow): string {
  if (r.task.stage === 'waiting') return 'Your inputs needed';
  return r.task.ownerName ? `${r.task.ownerName} at SBC` : 'SBC works on it';
}

/** "2 filings · 1 task" / "1 task" / "3 filings" — the count line of a list. */
export function rowWords(list: CalRow[]): string {
  const t = list.filter(isTaskRow).length;
  const f = list.length - t;
  const parts = [f ? `${f} filing${f === 1 ? '' : 's'}` : '', t ? `${t} task${t === 1 ? '' : 's'}` : ''].filter(Boolean);
  return parts.join(' · ') || '0 filings';
}
