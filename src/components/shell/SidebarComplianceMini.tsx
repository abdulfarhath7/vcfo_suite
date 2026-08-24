'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useComplianceFilings } from '@/hooks/use-compliance-filings';
import { parseIsoDate } from '@/components/admin/compliance-calendar-utils';
import { cn } from '@/lib/utils';

function complianceHref(role: string | undefined, staffBase: string): string {
  if (role === 'admin') return '/app/admin/compliance';
  if (role === 'manager') return `${staffBase}/compliance`;
  if (role === 'intern') return '/app/intern/compliance';
  if (role === 'client') return '/app/client/compliances';
  return '/app/manager/compliance';
}

/** Compact month grid. Today is the bright cell; due days are round marks. */
export function SidebarComplianceMini({
  expanded,
  staffBase,
  ink = 'dark',
}: {
  expanded: boolean;
  staffBase: string;
  ink?: 'light' | 'dark';
}) {
  const { user, engagements, getStateForEngagement } = useApp();
  const filings = useComplianceFilings(engagements, getStateForEngagement);

  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();

  const dueDays = useMemo(() => {
    const set = new Set<number>();
    for (const f of filings) {
      const d = parseIsoDate(f.nextDue);
      if (d.getFullYear() === year && d.getMonth() === month) {
        set.add(d.getDate());
      }
    }
    return set;
  }, [filings, year, month]);

  if (!user || !expanded) return null;

  const href = complianceHref(user.role, staffBase);
  const cells: Array<number | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const light = ink === 'light';

  return (
    <Link
      href={href}
      className={cn(
        'mx-1 mb-2 block rounded-xl border p-2 transition-colors',
        light
          ? 'border-white/18 bg-white/8 hover:bg-white/12'
          : 'border-border/60 bg-muted/30 hover:bg-blue-50/50',
      )}
      title="Open compliance calendar"
    >
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span
          className={cn(
            'font-mono text-[9px] uppercase tracking-[0.14em]',
            light ? 'text-white/88' : 'text-muted-foreground',
          )}
        >
          {now.toLocaleString('en-IN', { month: 'short' })} {year}
        </span>
        <span className={cn('text-[9px]', light ? 'text-white/90' : 'text-blue-700/80')}>
          {dueDays.size} due
        </span>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (day == null) {
            return <div key={`e-${i}`} className="h-4" />;
          }
          const hasDue = dueDays.has(day);
          const isToday = day === now.getDate();
          return (
            <div
              key={day}
              className={cn(
                'relative flex h-4 w-full items-center justify-center text-[8px] tabular-nums leading-none',
                isToday && 'rounded-full font-semibold',
                isToday && (light ? 'bg-white text-primary' : 'bg-primary text-white'),
                !isToday && hasDue && 'rounded-full font-medium',
                !isToday && hasDue && (light ? 'ring-1 ring-white/70 text-white' : 'ring-1 ring-primary/55 text-foreground'),
                !isToday && !hasDue && (light ? 'text-white/55' : 'text-muted-foreground/65'),
              )}
            >
              {day}
            </div>
          );
        })}
      </div>
    </Link>
  );
}
