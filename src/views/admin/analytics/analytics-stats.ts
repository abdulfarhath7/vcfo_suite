/**
 * Pure counts for the Analytics page, computed from the real engagement checklist state
 * the app already holds. No fetching, no React, so the numbers are easy to test.
 */

import type { StatusCode } from '@/data/checklist';

export interface StepState {
  status: StatusCode;
  completedOn?: string;
  assigneeId?: string;
}

export interface AnalyticsProject {
  internId: string;
  /** Status per checklist item id. */
  state: Record<string, StepState | undefined>;
}

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Plain date label, for example "14 Oct" (R-05). */
export function plainDay(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Local midnight of the Monday that starts the week holding `d`. */
function weekStart(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - offset);
  return out;
}

/** Parse "2026-10-14" (or a full ISO stamp) as a local calendar day. */
function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Steps marked completed in each of the last `weeks` weeks, oldest first, labelled by the week's Monday. */
export function stepsCompletedPerWeek(
  projects: AnalyticsProject[],
  itemIds: string[],
  today: Date,
  weeks = 8,
): Array<{ w: string; steps: number }> {
  const thisWeek = weekStart(today);
  const starts = Array.from({ length: weeks }, (_, i) => new Date(thisWeek.getTime() - (weeks - 1 - i) * 7 * DAY_MS));
  const counts = starts.map(() => 0);
  const first = starts[0].getTime();
  for (const p of projects) {
    for (const id of itemIds) {
      const s = p.state[id];
      if (!s || s.status !== 'completed' || !s.completedOn) continue;
      const day = parseDay(s.completedOn);
      if (!day) continue;
      const t = weekStart(day).getTime();
      if (t < first) continue;
      const index = Math.round((t - first) / (7 * DAY_MS));
      if (index >= 0 && index < weeks) counts[index] += 1;
    }
  }
  return starts.map((d, i) => ({ w: plainDay(d), steps: counts[i] }));
}

export type Health = 'overdue' | 'waiting' | 'progress' | 'notStarted' | 'done';

/** One word per project: overdue beats waiting, waiting beats in progress. */
export function projectHealth(project: AnalyticsProject, itemIds: string[]): Health {
  let open = 0;
  let done = 0;
  let waiting = false;
  let progress = false;
  for (const id of itemIds) {
    const status = project.state[id]?.status ?? 'not-started';
    if (status === 'not-applicable') continue;
    if (status === 'overdue') return 'overdue';
    if (status === 'completed') done += 1;
    else open += 1;
    if (status === 'awaiting-client') waiting = true;
    if (status === 'in-progress') progress = true;
  }
  if (waiting) return 'waiting';
  if (progress) return 'progress';
  if (open === 0 && done > 0) return 'done';
  if (done > 0) return 'progress';
  return 'notStarted';
}

export function clientHealthCounts(projects: AnalyticsProject[], itemIds: string[]): Record<Health, number> {
  const out: Record<Health, number> = { overdue: 0, waiting: 0, progress: 0, notStarted: 0, done: 0 };
  for (const p of projects) out[projectHealth(p, itemIds)] += 1;
  return out;
}

export interface LeadLoad {
  id: string;
  name: string;
  overdue: number;
  waiting: number;
  progress: number;
  notStarted: number;
  open: number;
}

/**
 * Open steps per project lead, split by status. A step belongs to its assignee, or to the
 * project's lead when nobody is assigned. Leads with no open steps are left out.
 */
export function workloadByLead(
  projects: AnalyticsProject[],
  itemIds: string[],
  leads: Array<{ id: string; name: string }>,
): LeadLoad[] {
  const names = new Map(leads.map((l) => [l.id, l.name]));
  const rows = new Map<string, LeadLoad>();
  for (const p of projects) {
    for (const id of itemIds) {
      const s = p.state[id];
      const status = s?.status ?? 'not-started';
      if (status === 'completed' || status === 'not-applicable') continue;
      const owner = s?.assigneeId || p.internId;
      const name = owner ? names.get(owner) : undefined;
      if (!owner || !name) continue;
      const row = rows.get(owner) ?? { id: owner, name, overdue: 0, waiting: 0, progress: 0, notStarted: 0, open: 0 };
      if (status === 'overdue') row.overdue += 1;
      else if (status === 'awaiting-client') row.waiting += 1;
      else if (status === 'in-progress') row.progress += 1;
      else row.notStarted += 1;
      row.open += 1;
      rows.set(owner, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}
