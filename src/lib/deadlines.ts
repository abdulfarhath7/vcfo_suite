import { addDays, addWeeks, differenceInDays, format } from 'date-fns';

export type DeadlineRule =
  | { kind: 'days-from-incorporation'; days: number }
  | { kind: 'fixed-window-weeks'; weeks: number }
  | { kind: 'estimated-weeks'; weeks: [number, number] }
  | { kind: 'no-statutory-limit' }
  | { kind: 'wherever-applicable' };

export function computeDueDate(rule: DeadlineRule, incorporationDate: Date | null): Date | null {
  if (!incorporationDate) return null;
  switch (rule.kind) {
    case 'days-from-incorporation':
      return addDays(incorporationDate, rule.days);
    case 'fixed-window-weeks':
      return addWeeks(incorporationDate, rule.weeks);
    case 'estimated-weeks':
      return addWeeks(incorporationDate, rule.weeks[1]);
    default:
      return null;
  }
}

export function daysLeft(due: Date | null): number | null {
  if (!due) return null;
  return differenceInDays(due, new Date());
}

export function formatTimeline(rule: DeadlineRule): string {
  switch (rule.kind) {
    case 'days-from-incorporation':
      return `Within ${rule.days} days of incorporation`;
    case 'fixed-window-weeks':
      return `Within ${rule.weeks} weeks of incorporation`;
    case 'estimated-weeks':
      return `${rule.weeks[0]}–${rule.weeks[1]} weeks`;
    case 'no-statutory-limit':
      return 'No statutory time limit';
    case 'wherever-applicable':
      return 'Wherever applicable';
  }
}

export function formatDate(d: Date | null): string {
  return d ? format(d, 'd MMM yyyy') : '—';
}
