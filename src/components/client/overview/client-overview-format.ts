import { PHASE_CLASSES, type PhaseColorKey } from '@/lib/phase-colors';
import type { ClientLegalForm } from '@/lib/client-overview';

/** en-IN so the dates read the way the filings do. */
const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};

export function formatClientDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', DATE_FMT);
}

export function formatClientDayMonth(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** "in 6 days" / "today" / "3 days ago" — the human read of a due date. */
export function relativeDayLabel(iso: string, now = new Date()): string {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return '';
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(target) - startOfDay(now)) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export const LEGAL_FORM_LABEL: Record<ClientLegalForm, string> = {
  company: 'Private Limited Company',
  llp: 'Limited Liability Partnership',
  partnership: 'Partnership Firm',
  proprietorship: 'Proprietorship',
};

/** Chart fill for a phase, as an `oklch(var(--…))` string SVG can consume. */
export const PHASE_FILL: Record<PhaseColorKey, string> = {
  pre: 'oklch(var(--phase-pre))',
  filing: 'oklch(var(--phase-filing))',
  post: 'oklch(var(--phase-post))',
  fema: 'oklch(var(--phase-fema))',
  registration: 'oklch(var(--phase-registration))',
  default: 'oklch(var(--primary))',
};

export function phaseTone(key: PhaseColorKey) {
  return PHASE_CLASSES[key];
}
