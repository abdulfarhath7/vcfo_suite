import { CalendarDays, FileSpreadsheet } from 'lucide-react';
import { TONE } from '@/components/shell/nav-tones';
import type { SidebarNavLeaf } from '@/components/shell/SidebarNavGroup';

/**
 * COMPLIANCES NAV — the one place that knows where each shell's
 * Compliances → Calendar / Filings pages live.
 *
 * Every role has the same two children under `{base}/compliances/`. The base
 * is the shell's own segment for client, intern, admin and manager; the
 * super admin has no compliance routes of its own and, like its Firm / People
 * / Email entries, jumps into the firm scope at `/app/admin`.
 */
export function compliancesBasePath(role: string | undefined, staffBase: string): string {
  if (role === 'client') return '/app/client';
  if (role === 'intern') return '/app/intern';
  if (role === 'admin' || role === 'super_admin') return '/app/admin';
  return staffBase;
}

export function complianceCalendarPath(role: string | undefined, staffBase: string): string {
  return `${compliancesBasePath(role, staffBase)}/compliances/calendar`;
}

/** The two leaves of the Compliances disclosure, in nav order. */
export function complianceLeaves(base: string): SidebarNavLeaf[] {
  return [
    { to: `${base}/compliances/calendar`, label: 'Calendar', icon: CalendarDays, iconTone: TONE.calendar },
    { to: `${base}/compliances/filings`, label: 'Filings', icon: FileSpreadsheet, iconTone: TONE.files },
  ];
}
