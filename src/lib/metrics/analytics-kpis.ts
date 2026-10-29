/**
 * ANALYTICS KPIS — the number tiles on the staff Analytics page, computed the same way on the
 * page (from the checklist state the app holds) and in the month-end snapshot job
 * (`src/jobs/kpi-snapshots.ts`), so the change tag compares like with like (S-618).
 *
 * Pure: no database, no React.
 */

export type StepStatusMap = Record<string, { status?: string | null } | undefined>;

export interface AnalyticsKpis {
  projects: number;
  stepsDone: number;
  stepsTotal: number;
  awaitingClient: number;
  overdue: number;
}

/** The live tile values across the given projects' checklist states. */
export function analyticsKpis(states: StepStatusMap[], itemIds: readonly string[]): AnalyticsKpis {
  let stepsDone = 0;
  let stepsTotal = 0;
  let awaitingClient = 0;
  let overdue = 0;
  for (const state of states) {
    for (const id of itemIds) {
      const s = state[id]?.status ?? 'not-started';
      if (s === 'not-applicable') continue;
      stepsTotal += 1;
      if (s === 'completed') stepsDone += 1;
      if (s === 'awaiting-client') awaitingClient += 1;
      if (s === 'overdue') overdue += 1;
    }
  }
  return { projects: states.length, stepsDone, stepsTotal, awaitingClient, overdue };
}

/** Snapshot keys, one per Analytics tile. */
export const KPI_KEYS = ['projects', 'steps_done', 'awaiting_client', 'on_time_pct', 'overdue_steps'] as const;
export type KpiKey = (typeof KPI_KEYS)[number];

/** The last day of the month before `now`, in India time, as YYYY-MM-DD. */
export function previousMonthEnd(now: Date): string {
  const ist = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  const [y, m] = ist.split('-').map(Number) as [number, number];
  // Day 0 of this month is the last day of the previous one.
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
}

/**
 * The change against last month's snapshot, or null when there is no snapshot (a new install,
 * or the job has not run yet) or no live value. Percentages compare in points.
 */
export function kpiChange(live: number | null | undefined, previous: number | null | undefined): number | null {
  if (live === null || live === undefined || previous === null || previous === undefined) return null;
  if (!Number.isFinite(live) || !Number.isFinite(previous)) return null;
  return Math.round((live - previous) * 10) / 10;
}
