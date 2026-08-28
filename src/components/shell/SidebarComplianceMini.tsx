'use client';

import Link from 'next/link';
import { memo, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { STATUTORY_DEADLINES } from '@/data/statutory-calendar-fy2627';
import { cn } from '@/lib/utils';

function complianceHref(role: string | undefined, staffBase: string): string {
  if (role === 'admin') return '/app/admin/compliance';
  if (role === 'manager') return `${staffBase}/compliance`;
  if (role === 'intern') return '/app/intern/compliance';
  if (role === 'client') return '/app/client/compliances';
  return '/app/manager/compliance';
}

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
                'relative flex h-[18px] w-full items-center justify-center rounded-full text-[8.5px] tabular-nums leading-none',
                isToday && 'font-bold',
                isToday && (light ? 'bg-white text-primary' : 'bg-primary text-white'),
                !isToday && hasDue && 'border bg-transparent font-semibold',
                !isToday &&
                  hasDue &&
                  (light
                    ? 'border-white/80 text-white'
                    : 'border-primary/70 text-primary'),
                !isToday && !hasDue && (light ? 'text-white/80' : 'text-foreground/75'),
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
