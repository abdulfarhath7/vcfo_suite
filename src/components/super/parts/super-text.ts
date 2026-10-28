import { sep } from '@/lib/date-format';

/**
 * Text helpers for the super admin screens: plain dates (R-29) and short company names.
 * Kept apart from the components so the component file only exports components.
 */

/* ---------- Dates ---------- */

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };

/** R-29: a plain date, "14 Oct". Accepts YYYY-MM-DD or an ISO timestamp. */
export function plainDay(value: string | null | undefined): string {
  const v = value?.trim();
  if (!v) return '–';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v);
  if (Number.isNaN(date.getTime())) return '–';
  return sep(date.toLocaleDateString('en-GB', DAY_MONTH));
}

/** Today as YYYY-MM-DD (UTC, the same day key the server uses). */
export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Initials of a company, without the legal suffix. */
export function companyInitials(name: string): string {
  const words = name
    .replace(/\b(private limited|pvt\.? ltd\.?|limited|ltd\.?|llp)\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : words[0]!.slice(0, 2)).toUpperCase();
}

/** Short company name without the legal suffix, for dense rows. */
export function shortCompany(name: string): string {
  return name.replace(/\s+(private limited|pvt\.? ltd\.?|limited|llp)$/i, '').trim() || name;
}
