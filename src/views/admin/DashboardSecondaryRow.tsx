'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { sep } from '@/lib/date-format';
import { staffProjectBaseFromPathname } from '@/lib/projects/project-step-path';
import { cn } from '@/lib/utils';
import { exactDate, relativeDue } from '@/lib/relative-due';
import type { AdminDashboardViewProps } from '@/views/admin/DashboardSections';

type Urgency = 'bad' | 'warn' | 'idle';

/** Urgency of a filing for its date tile: late is red, inside seven days amber, later plain. */
function filingUrgency(status: string, nextDue: string, now: number): Urgency {
  if (status === 'overdue') return 'bad';
  const delta = new Date(nextDue).getTime() - now;
  if (delta < 0 && status !== 'filed') return 'bad';
  if (delta <= 7 * 86_400_000) return 'warn';
  return 'idle';
}

const TILE: Record<Urgency, string> = {
  bad: 'border-transparent bg-danger-soft text-danger',
  warn: 'border-transparent bg-warning-soft text-warning',
  idle: 'border-line bg-surface-raised text-ink',
};

function chipFor(status: string, urgency: Urgency): { word: string; tone: ChipTone } {
  if (status === 'filed') return { word: 'Done', tone: 'ok' };
  if (urgency === 'bad') return { word: 'Overdue', tone: 'bad' };
  if (status === 'in-progress') return { word: 'In progress', tone: 'prog' };
  if (urgency === 'warn') return { word: 'Due soon', tone: 'warn' };
  return { word: 'Not started', tone: 'idle' };
}

/**
 * Upcoming filings (R-20 attention list): full-width rows with a 44px date tile tinted by
 * urgency, the filing and the company, and the status chip on the right. A late row is tinted
 * soft red and carries a small navy action. Every row opens the compliance calendar.
 */
export function AdminDashboardFilingsPanel({
  engagements,
  dueSoon,
}: Pick<AdminDashboardViewProps, 'engagements' | 'dueSoon'>) {
  const pathname = usePathname();
  const staffBase = useStaffBasePath();
  const calendarHref = `${staffProjectBaseFromPathname(pathname, staffBase)}/compliances/calendar`;
  const now = Date.now();

  return (
    <DashSection
      icon={CalendarDays}
      title="Upcoming filings"
      meta={dueSoon.length ? String(dueSoon.length) : undefined}
      href={calendarHref}
      hrefLabel="Calendar"
      bodyClassName="p-0"
    >
      {dueSoon.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-ink-muted">No filings due in the next 14 days</p>
      ) : (
        <ul>
          {dueSoon.slice(0, 8).map((c) => {
            const eng = engagements.find((e) => e.id === c.engagementId);
            const due = new Date(c.nextDue);
            const day = sep(due.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' }));
            const month = sep(due.toLocaleDateString('en-GB', { month: 'short', timeZone: 'Asia/Kolkata' }));
            const urgency = filingUrgency(c.status, c.nextDue, now);
            const urgent = urgency === 'bad';
            const chip = chipFor(c.status, urgency);
            return (
              <li
                key={c.id}
                className={cn(
                  'relative flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-3 first:border-t-0 hover:bg-surface-sunken/60',
                  urgent && 'bg-danger-soft hover:bg-danger-soft',
                )}
              >
                <span
                  className={cn('grid w-11 flex-none place-items-center rounded-md border-1.5 py-1 leading-none', TILE[urgency])}
                  title={exactDate(c.nextDue)}
                  aria-hidden
                >
                  <b className="text-[16px] font-medium tabular-nums">{day}</b>
                  <span className={cn('text-[10.5px] font-medium uppercase tracking-wider', urgency === 'idle' ? 'text-ink-muted' : 'opacity-80')}>
                    {month}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    href={calendarHref}
                    className="block truncate text-[13.5px] font-medium text-ink after:absolute after:inset-0 hover:underline"
                  >
                    {c.filing}
                  </Link>
                  {/* E-11: the sub line starts with the relative due words; the exact date is the tooltip. */}
                  <span className="block truncate text-[12.5px] text-ink-muted" title={exactDate(c.nextDue)}>
                    {[c.status === 'filed' ? null : relativeDue(c.nextDue), eng?.companyName, c.authority].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Chip tone={chip.tone} fixed className="relative">
                  {chip.word}
                </Chip>
                {urgent ? (
                  <Button size="sm" variant="strong" asChild className="relative">
                    <Link href={calendarHref}>Open</Link>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </DashSection>
  );
}
