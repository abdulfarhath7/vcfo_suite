import type { ReportSchedule } from './partner-report';

/**
 * When a scheduled saved report is due (G-21). The Inngest function `saved-reports-send` runs
 * once a day and sends every report this says is due, then stores `last_sent_at`.
 *
 * - weekly: never sent, or last sent at least six and a half days ago (half a day of slack so
 *   a run that starts a few minutes early does not skip a week);
 * - monthly: never sent, or last sent in an earlier calendar month (India time), so the first
 *   run of each month sends it;
 * - none: never due.
 */
const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

function istMonth(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

export function isReportDue(schedule: ReportSchedule, lastSentAt: Date | null, now: Date): boolean {
  if (schedule === 'none') return false;
  if (!lastSentAt) return true;
  if (schedule === 'weekly') return now.getTime() - lastSentAt.getTime() >= 6.5 * DAY_MS;
  return istMonth(lastSentAt) < istMonth(now);
}
