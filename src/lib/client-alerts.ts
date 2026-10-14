import type { ClientOverviewComplianceItem, ClientOverviewNeed } from '@/lib/client-overview';

/**
 * IMPORTANT ALERTS — the dated things a client must not miss: their own open
 * steps that carry a manager window, and statutory filings. Overdue first,
 * then by due date. Pure, so the dashboard card and its tests read the same.
 */

export const ALERT_WINDOW_DAYS = [15, 30] as const;
export type AlertWindowDays = (typeof ALERT_WINDOW_DAYS)[number];

export interface ClientAlert {
  id: string;
  kind: 'step' | 'filing';
  title: string;
  /** Short context under the title: "Your step" or the filing group. */
  meta: string;
  /** ISO calendar date. */
  dueDate: string;
  /** Whole days from today; negative once overdue. */
  daysLeft: number;
  href: string;
}

const DAY_MS = 86_400_000;

function daysUntil(isoDate: string, now: Date): number | null {
  const due = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(due)) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / DAY_MS);
}

export function buildClientAlerts(
  needs: readonly ClientOverviewNeed[],
  upcoming: readonly ClientOverviewComplianceItem[],
  now: Date,
): ClientAlert[] {
  const horizon = ALERT_WINDOW_DAYS[ALERT_WINDOW_DAYS.length - 1];
  const out: ClientAlert[] = [];

  for (const need of needs) {
    if (!need.dueDate) continue;
    const daysLeft = daysUntil(need.dueDate, now);
    if (daysLeft === null || daysLeft > horizon) continue;
    out.push({
      id: `step:${need.stepId}`,
      kind: 'step',
      title: need.title,
      meta: 'Your step',
      dueDate: need.dueDate,
      daysLeft,
      href: need.href,
    });
  }

  for (const filing of upcoming) {
    if (filing.status === 'filed') continue;
    const daysLeft = daysUntil(filing.dueDate, now);
    if (daysLeft === null || daysLeft > horizon) continue;
    out.push({
      id: `filing:${filing.id}`,
      kind: 'filing',
      title: filing.title,
      meta: filing.periodLabel ? `${filing.group} · ${filing.periodLabel}` : filing.group,
      dueDate: filing.dueDate,
      daysLeft,
      href: `/app/client/compliances/calendar?date=${filing.dueDate.slice(0, 10)}`,
    });
  }

  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title));
}

/** Overdue alerts always count; the rest only when due inside the window. */
export function alertsWithin(alerts: readonly ClientAlert[], days: number): ClientAlert[] {
  return alerts.filter((alert) => alert.daysLeft <= days);
}

/** "Overdue 3d", "Due today", "In 4 days". */
export function alertDueLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Overdue ${Math.abs(daysLeft)}d`;
  if (daysLeft === 0) return 'Due today';
  if (daysLeft === 1) return 'Tomorrow';
  return `In ${daysLeft} days`;
}
