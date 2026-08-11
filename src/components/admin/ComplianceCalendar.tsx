'use client';

import { useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { buttonVariants } from '@/components/ui/button-variants';
import { isSameMonth, parseIsoDate, yearRange } from '@/components/admin/compliance-calendar-utils';
import { cn } from '@/lib/utils';
import type { ComplianceFiling } from '@/data/compliance';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const calendarClassNames = {
  month_caption: 'hidden',
  nav: 'hidden',
  dropdowns: 'hidden',
  weekday:
    'text-muted-foreground rounded-md w-9 font-mono text-[0.65rem] uppercase tracking-wider font-normal',
  day_button: cn(
    buttonVariants({ variant: 'ghost' }),
    'h-9 w-9 p-0 font-normal rounded-md transition-colors duration-150 motion-reduce:transition-none',
    'hover:bg-accent hover:text-accent-foreground',
  ),
  today: 'bg-accent/80 text-accent-foreground ring-1 ring-gold/40 font-medium',
  outside: 'text-muted-foreground opacity-40',
  disabled: 'text-muted-foreground opacity-40',
};

const statusDayClass: Record<ComplianceFiling['status'], string> = {
  overdue: 'bg-danger-light text-danger-text font-medium ring-1 ring-danger/30',
  upcoming: 'bg-info-light text-info-text font-medium ring-1 ring-info/25',
  'in-progress': 'bg-warning-light text-warning-text font-medium ring-1 ring-warning/30',
  filed: 'bg-success-light text-success-text font-medium ring-1 ring-success/25',
};

const modifiersClassNames = {
  overdue: statusDayClass.overdue,
  upcoming: statusDayClass.upcoming,
  inProgress: statusDayClass['in-progress'],
  filed: statusDayClass.filed,
};

export interface ComplianceCalendarProps {
  filings: ComplianceFiling[];
  month: Date;
  onMonthChange: (month: Date) => void;
}

export function ComplianceCalendar({ filings, month, onMonthChange }: ComplianceCalendarProps) {
  const years = useMemo(() => yearRange(filings), [filings]);

  const monthFilings = useMemo(
    () => filings.filter((f) => isSameMonth(f.nextDue, month)),
    [filings, month],
  );

  const modifiers = useMemo(() => {
    const overdue: Date[] = [];
    const upcoming: Date[] = [];
    const inProgress: Date[] = [];
    const filed: Date[] = [];
    for (const f of monthFilings) {
      const d = parseIsoDate(f.nextDue);
      if (f.status === 'overdue') overdue.push(d);
      else if (f.status === 'upcoming') upcoming.push(d);
      else if (f.status === 'in-progress') inProgress.push(d);
      else filed.push(d);
    }
    return { overdue, upcoming, inProgress, filed };
  }, [monthFilings]);

  const setMonthYear = (nextMonth: number, nextYear: number) => {
    onMonthChange(new Date(nextYear, nextMonth, 1));
  };

  return (
    <div className="p-4 border-b lg:border-b-0 lg:border-r border-border bg-muted/20">
      <div className="flex items-center gap-2 mb-3">
        <label className="sr-only" htmlFor="compliance-month">
          Month
        </label>
        <select
          id="compliance-month"
          value={month.getMonth()}
          onChange={(e) => setMonthYear(Number(e.target.value), month.getFullYear())}
          className="h-8 flex-1 min-w-0 rounded-md border border-border bg-surface px-2 text-[12px] font-serif text-ink capitalize"
        >
          {MONTH_LABELS.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="compliance-year">
          Year
        </label>
        <select
          id="compliance-year"
          value={month.getFullYear()}
          onChange={(e) => setMonthYear(month.getMonth(), Number(e.target.value))}
          className="h-8 w-[5.5rem] shrink-0 rounded-md border border-border bg-surface px-2 font-mono text-[11px] text-ink tabular-nums"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <Calendar
        month={month}
        onMonthChange={onMonthChange}
        hideNavigation
        showOutsideDays
        fixedWeeks
        className="rounded-lg border border-border bg-surface p-2 mx-auto"
        classNames={calendarClassNames}
        modifiers={modifiers}
        modifiersClassNames={modifiersClassNames}
      />

      <p className="mt-3 text-[11px] text-text-tertiary text-center">
        {monthFilings.length === 0
          ? 'No filings due this month'
          : `${monthFilings.length} filing${monthFilings.length === 1 ? '' : 's'} due this month`}
      </p>

      <ul className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-text-tertiary">
        <li className="inline-flex items-center gap-1">
          <span className={cn('h-2 w-2 rounded-full', statusDayClass.overdue)} aria-hidden />
          Past due
        </li>
        <li className="inline-flex items-center gap-1">
          <span className={cn('h-2 w-2 rounded-full', statusDayClass.upcoming)} aria-hidden />
          Due soon
        </li>
        <li className="inline-flex items-center gap-1">
          <span className={cn('h-2 w-2 rounded-full', statusDayClass['in-progress'])} aria-hidden />
          In preparation
        </li>
        <li className="inline-flex items-center gap-1">
          <span className={cn('h-2 w-2 rounded-full', statusDayClass.filed)} aria-hidden />
          Filed
        </li>
      </ul>
    </div>
  );
}
