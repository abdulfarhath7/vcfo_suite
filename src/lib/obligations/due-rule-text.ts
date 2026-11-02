import type { DueRule } from '@/lib/compliance/types';

/**
 * A plain-English sentence for an obligation's stored `due_rule` (G-04).
 *
 * The sentence describes the rule the register uses to generate due dates,
 * so it always matches the dates on screen. Months in `fixed-calendar-date`
 * and `quarterly-calendar` are 0-based (0 is January), as the generator
 * reads them with `new Date(year, month, day)`.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const last = n % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

/** "15 Jun"; a day past the month's end rolls over as the generator does ("31 Jun" is 1 Jul). */
function dayMonth(month: number, day: number): string {
  const d = new Date(Date.UTC(2025, month, day));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The calendar date that falls `days` after 31 March. */
function afterFyEnd(days: number): string {
  const d = new Date(Date.UTC(2026, 2, 31) + days * 86_400_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function isRule(value: unknown): value is DueRule {
  return Boolean(value && typeof value === 'object' && typeof (value as { kind?: unknown }).kind === 'string');
}

/**
 * One sentence, or null when the rule is missing or of a kind this file does
 * not know (the screen then leaves the line out instead of guessing).
 * `fyEnd` says the obligation is generated once per financial year, so a
 * fixed date reads "after each financial year".
 */
export function dueRuleSentence(rule: unknown, opts: { fyEnd?: boolean } = {}): string | null {
  if (!isRule(rule)) return null;
  switch (rule.kind) {
    case 'fixed-calendar-date':
      if (typeof rule.month !== 'number' || typeof rule.day !== 'number') return null;
      return opts.fyEnd
        ? `Due by ${dayMonth(rule.month, rule.day)} after each financial year.`
        : `Due by ${dayMonth(rule.month, rule.day)} each year.`;
    case 'quarterly-calendar': {
      const quarters = Array.isArray(rule.quarters) ? rule.quarters : [];
      if (!quarters.length) return null;
      const parts = quarters.map((q) => `${dayMonth(q.month, q.day)}${q.label ? ` (${q.label})` : ''}`);
      return `Due each quarter: ${parts.join(', ')}.`;
    }
    case 'nth-day-next-month':
      if (typeof rule.day !== 'number') return null;
      return `Due by the ${ordinal(rule.day)} of the following month.`;
    case 'days-after-fy-end':
      if (typeof rule.days !== 'number') return null;
      return `Due ${rule.days} days after the financial year ends on 31 Mar, which is ${afterFyEnd(rule.days)}.`;
    case 'days-after-agm':
      if (typeof rule.days !== 'number') return null;
      return `Due within ${rule.days} days of the annual general meeting.`;
    case 'days-after-event':
      if (typeof rule.days !== 'number') return null;
      return `Due within ${rule.days} days of the event that triggers it.`;
    case 'monthly-from-anchor':
      return 'Due every month from the date the obligation starts.';
    default:
      return null;
  }
}
