'use client';

import { cn } from '@/lib/utils';
import { SEGMENT_FILL, type SegmentTone } from '@/components/dash/charts';

/**
 * Week strip (prototype cards/WeekStrip): seven day boxes for "This week". Each box shows the
 * day, a count badge and the first two items; more items read "+2 more". A click picks the day,
 * a second click clears it (`onChange(-1)`). On phones the boxes become compact day buttons
 * with one dot.
 */
export interface WeekStripItem {
  id: string;
  text: string;
  tone: SegmentTone;
  /** Red text: a statutory filing. */
  strong?: boolean;
}

export interface WeekStripDay {
  key: string;
  /** "Mon". */
  dow: string;
  /** "5". */
  day: string;
  today?: boolean;
  items: WeekStripItem[];
}

export interface WeekStripLegend {
  label: string;
  tone: SegmentTone;
}

export function WeekStrip({
  days,
  value,
  onChange,
  legend,
  className,
}: {
  days: WeekStripDay[];
  /** The picked day index, or -1. */
  value: number;
  onChange: (index: number) => void;
  legend?: WeekStripLegend[];
  className?: string;
}) {
  return (
    <div className={cn('grid gap-3', className)}>
      <div className="grid grid-cols-7 gap-1.5 md:gap-2" role="group" aria-label="Days">
        {days.map((dd, i) => {
          const sel = i === value;
          const n = dd.items.length;
          const allDone = n > 0 && dd.items.every((x) => x.tone === 'ok');
          return (
            <button
              key={dd.key}
              type="button"
              aria-pressed={sel}
              aria-label={`${dd.dow} ${dd.day} · ${n} ${n === 1 ? 'item' : 'items'}`}
              onClick={() => onChange(sel ? -1 : i)}
              className={cn(
                'flex min-w-0 flex-col items-center gap-1 rounded-md border px-1 py-2 text-left md:min-h-[112px] md:items-stretch md:gap-1.5 md:px-2.5 md:py-2.5',
                dd.today ? 'border-navy bg-surface-sunken' : n ? 'border-line bg-surface' : 'border-line-soft bg-surface-sunken',
                sel && 'ring-2 ring-navy ring-offset-1 ring-offset-surface',
              )}
            >
              <span className="flex w-full items-center justify-center gap-1.5 md:justify-between">
                <span className={cn('text-[11.5px] md:text-[12px]', !n && !dd.today && 'text-ink-muted', dd.today && 'font-semibold')}>
                  <span className="block md:inline">{dd.dow}</span>{' '}
                  <b className="block text-[14px] font-semibold md:inline md:text-[12px]">{dd.day}</b>
                </span>
                {n > 0 ? (
                  <span className={cn('hidden h-[18px] min-w-[20px] place-items-center rounded-sm px-1 text-[11px] font-bold text-white md:inline-grid', allDone ? 'bg-positive-mid' : 'bg-navy')}>
                    {n}
                  </span>
                ) : null}
              </span>
              <i className={cn('h-1.5 w-1.5 rounded-[2px] md:hidden', n ? (allDone ? 'bg-positive-mid' : 'bg-brand') : 'bg-transparent')} aria-hidden />
              <span className="hidden min-w-0 flex-col gap-1 md:flex">
                {dd.items.slice(0, 2).map((x) => (
                  <span
                    key={x.id}
                    className={cn('flex min-w-0 items-center gap-1.5 text-[11.5px]', x.strong ? 'font-semibold text-danger' : x.tone === 'ok' ? 'text-ink-muted' : 'text-ink')}
                  >
                    <i className={cn('h-1.5 w-1.5 flex-none rounded-[2px]', SEGMENT_FILL[x.tone])} aria-hidden />
                    <span className="truncate">{x.text}</span>
                  </span>
                ))}
                {n > 2 ? <span className="text-[11.5px] font-semibold text-ink-muted">+{n - 2} more</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      {legend ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <i className={cn('h-2 w-2 rounded-[2px]', SEGMENT_FILL[l.tone])} aria-hidden />
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
