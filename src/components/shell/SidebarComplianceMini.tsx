'use client';

import Link from 'next/link';
import { memo, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { STATUTORY_DEADLINES } from '@/data/statutory-calendar-fy2627';
import { complianceCalendarPath } from '@/components/shell/compliance-nav';
import { cn } from '@/lib/utils';

/** Compact month grid. Today is the bright cell; due days are round marks. */
export const SidebarComplianceMini = memo(function SidebarComplianceMini({
  expanded,
  staffBase,
  ink = 'dark',
}: {
  expanded: boolean;
  staffBase: string;
  ink?: 'light' | 'dark';
}) {
  const { user } = useApp();

  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();

  // Same source as the statutory calendar page this card links to.
  const dueDays = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const set = new Set<number>();
    for (const d of STATUTORY_DEADLINES) {
      if (d.date.startsWith(prefix)) set.add(Number(d.date.slice(8, 10)));
    }
    return set;
  }, [year, month]);

  if (!user || !expanded) return null;

  // Same target as the Compliances → Calendar leaf in this shell's group.
  const href = complianceCalendarPath(user.role, staffBase);
  const cells: Array<number | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const light = ink === 'light';

  return (
    <Link
      href={href}
      className={cn(
        'mx-1 mb-2 block rounded-md border p-2 transition-colors',
        light
          ? 'border-side-line bg-side-active/60 hover:bg-side-active'
          : 'border-line bg-surface-sunken hover:bg-brand-soft',
      )}
      title="Open compliance calendar"
    >
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span
          className={cn(
            'text-[10px] font-semibold tracking-[0.06em]',
            light ? 'text-side-muted' : 'text-ink-muted',
          )}
        >
          {now.toLocaleString('en-IN', { month: 'short' })} {year}
        </span>
        <span className={cn('text-[10px] font-medium', light ? 'text-side-ink' : 'text-brand')}>
          {dueDays.size} due
        </span>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day == null) {
            return <div key={`e-${i}`} className="h-[18px]" />;
          }
          const hasDue = dueDays.has(day);
          const isToday = day === now.getDate();
          return (
            <div
              key={day}
              className={cn(
                'relative flex h-[18px] w-full items-center justify-center rounded-sm text-[8.5px] tabular-nums leading-none',
                isToday && 'font-semibold',
                isToday && (light ? 'bg-side-ink text-side' : 'bg-brand text-on-brand'),
                !isToday && hasDue && 'border bg-transparent font-semibold',
                !isToday &&
                  hasDue &&
                  (light
                    ? 'border-side-muted text-side-ink'
                    : 'border-brand/70 text-brand'),
                !isToday && !hasDue && (light ? 'text-side-muted' : 'text-ink-muted'),
              )}
            >
              {day}
            </div>
          );
        })}
      </div>
    </Link>
  );
});
