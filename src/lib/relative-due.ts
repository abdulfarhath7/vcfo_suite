/**
 * Relative due words (VCFO Spectrum E-11). A due cell or an attention list can say "In 3 days",
 * "Today" or "2 days late", and show the exact date ("Mon 19 Oct 2026") in a tooltip.
 *
 * Both helpers count whole calendar days in the viewer's local time zone, so "Tomorrow" flips at
 * local midnight and not 24 hours after the time of day in `now`.
 */

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A date-only ISO string ("2026-10-19") is read as a local calendar day, not as UTC midnight. */
function toDate(value: Date | string): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const d = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayNumber(d: Date): number {
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
}

/** Whole calendar days from `now` to `date`: 0 today, 1 tomorrow, -2 two days ago. Null for a bad date. */
export function daysUntil(date: Date | string, now: Date = new Date()): number | null {
  const d = toDate(date);
  if (!d) return null;
  return dayNumber(d) - dayNumber(now);
}

/**
 * "Today", "Tomorrow" or "In 3 days". A past date says how late it is ("1 day late",
 * "2 days late"), never "Yesterday". An empty string for a date that cannot be read.
 */
export function relativeDue(date: Date | string, now: Date = new Date()): string {
  const n = daysUntil(date, now);
  if (n === null) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 1) return `In ${n} days`;
  const late = -n;
  return `${late} ${late === 1 ? 'day' : 'days'} late`;
}

/** The exact date for the tooltip: "Mon 19 Oct 2026". An empty string for a date that cannot be read. */
export function exactDate(date: Date | string): string {
  const d = toDate(date);
  if (!d) return '';
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}
