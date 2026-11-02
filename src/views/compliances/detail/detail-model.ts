import type { ActivityEntry, ReminderState, ReminderView } from '@/views/compliances/detail/detail-parts';

/** Pure mappers from the compliance routes to the detail cards. */

/** The route's reminder rows as the card draws them (dates only, no times). */
export function reminderViews(
  rows: ReadonlyArray<{
    key: string;
    label: string;
    to: string;
    date: string;
    state: ReminderState;
    internal: boolean;
    enabled?: boolean;
    offsetDays?: number;
    overridden?: boolean;
  }>,
): ReminderView[] {
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    to: r.to,
    dateIso: r.date,
    state: r.state,
    internal: r.internal,
    enabled: r.enabled,
    offsetDays: r.offsetDays,
    overridden: r.overridden,
  }));
}

/** The route's history rows as Activity entries; a row without a person reads "VCFO". */
export function activityEntries(rows: ReadonlyArray<{ at: string; who: string | null; what: string }>): ActivityEntry[] {
  return rows.map((h, i) => ({ key: `${h.at}-${i}`, who: h.who ?? 'VCFO', what: h.what, at: h.at }));
}

/** DR-22: "Reminders start once the owner and the activity confirmation are set." */
export function blockedLine(gaps: readonly string[]): string | null {
  if (gaps.length === 0) return null;
  return `Reminders are on hold until these are set: ${gaps.join(', ')}.`;
}
