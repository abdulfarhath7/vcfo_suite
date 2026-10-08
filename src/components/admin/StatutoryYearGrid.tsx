'use client';

import { useMemo } from 'react';
import type { StatutoryDeadline } from '@/data/statutory-calendar-fy2627';
import {
  buildStatutoryMonthGrid,
  statutoryMonthPrefix,
  statutoryStatus,
  summariseStatutoryMonth,
  trimStatutoryMonthGrid,
  type StatutoryStatus,
} from '@/components/admin/statutory-calendar-utils';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Worst state on a day decides its dot — one overdue outranks ten upcoming. */
function worstStatus(
  items: readonly StatutoryDeadline[],
  todayIso: string,
): StatutoryStatus | null {
  if (items.length === 0) return null;
  let worst: StatutoryStatus = 'upcoming';
  for (const item of items) {
    const status = statutoryStatus(item.date, todayIso);
    if (status === 'overdue') return 'overdue';
    if (status === 'due-soon') worst = 'due-soon';
  }
  return worst;
}

function MonthCard({
  month,
  byDate,
  todayIso,
  isCurrent,
  onPick,
}: {
  month: Date;
  byDate: ReadonlyMap<string, readonly StatutoryDeadline[]>;
  todayIso: string;
  isCurrent: boolean;
  onPick: (month: Date) => void;
}) {
  const prefix = statutoryMonthPrefix(month);
  const cells = useMemo(
    () => trimStatutoryMonthGrid(buildStatutoryMonthGrid(month)),
    [month],
  );

  // One pass over this month's dates, not over every deadline in the year.
  const summary = useMemo(() => {
    const dates: { date: string }[] = [];
    for (const [iso, items] of byDate) {
      if (!iso.startsWith(prefix)) continue;
      for (const item of items) dates.push({ date: item.date });
    }
    return summariseStatutoryMonth(dates, prefix, todayIso);
  }, [byDate, prefix, todayIso]);

  const monthName = month.toLocaleDateString('en-IN', { month: 'long' });
  const label =
    summary.total === 0
      ? `${monthName} ${month.getFullYear()}, nothing due`
      : `${monthName} ${month.getFullYear()}, ${summary.total} ${
          summary.total === 1 ? 'deadline' : 'deadlines'
        }${summary.overdue > 0 ? `, ${summary.overdue} overdue` : ''}`;

  return (
    <button
      type="button"
      onClick={() => onPick(month)}
      aria-label={label}
      className={cn('cal-mcard', isCurrent && 'is-current')}
    >
      <span className="cal-mcard-head">
        <span className="cal-mcard-name">
          {monthName} <span className="cal-mcard-year">{month.getFullYear()}</span>
        </span>
        <span
          className={cn(
            'cal-mcard-n',
            summary.total === 0 && 'is-zero',
            summary.overdue > 0 && 'is-overdue',
          )}
        >
          {summary.total}
        </span>
      </span>

      <span className="cal-mcard-dows" aria-hidden>
        {WEEKDAYS.map((w, i) => (
          <span key={`${w}-${i}`} className="cal-mcard-dow">
            {w}
          </span>
        ))}
      </span>

      <span className="cal-mcard-grid" aria-hidden>
        {cells.map((cell) => {
          const items = cell.inMonth ? (byDate.get(cell.iso) ?? []) : [];
          const status = worstStatus(items, todayIso);
          return (
            <span
              key={cell.iso}
              className={cn('cal-mcard-day', !cell.inMonth && 'is-outside')}
              data-today={cell.iso === todayIso ? 'true' : undefined}
            >
              <span className="cal-mcard-num">{cell.day}</span>
              <span
                className={cn(
                  'cal-mcard-dot',
                  status === null && 'is-empty',
                  status === 'due-soon' && 'is-due-soon',
                  status === 'overdue' && 'is-overdue',
                )}
              />
            </span>
          );
        })}
      </span>
    </button>
  );
}

/**
 * YEAR VIEW — the fiscal year as twelve month cards.
 *
 * The month view answers "what is due next"; this answers "which months are
 * heavy", which is the question a partner planning capacity actually asks.
 * Each card is a button: picking one drops back into the month view on it.
 *
 * Colour follows the page contract — a dot per loaded day, hued only when
 * that day is overdue or due soon, and a month total that turns red only
 * when something inside it has already slipped.
 */
export function StatutoryYearGrid({
  months,
  byDate,
  todayIso,
  currentMonth,
  onPickMonth,
}: {
  months: readonly Date[];
  /** Every deadline in the fiscal year, bucketed by ISO date. */
  byDate: ReadonlyMap<string, readonly StatutoryDeadline[]>;
  todayIso: string;
  currentMonth: Date;
  onPickMonth: (month: Date) => void;
}) {
  const currentPrefix = statutoryMonthPrefix(currentMonth);
  return (
    <div className="cal-year">
      {months.map((month) => (
        <MonthCard
          key={statutoryMonthPrefix(month)}
          month={month}
          byDate={byDate}
          todayIso={todayIso}
          isCurrent={statutoryMonthPrefix(month) === currentPrefix}
          onPick={onPickMonth}
        />
      ))}
    </div>
  );
}
