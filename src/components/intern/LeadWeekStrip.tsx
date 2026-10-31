'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { internToneBg } from '@/components/intern/intern-tones';
import {
  WEEK_CHIP_KIND_ORDER,
  WEEK_CHIP_TONE,
  formatIstWeekdayDay,
  internWeekChipsForDay,
  internWeekDayCounts,
  internWorkPath,
  istWeekYmds,
  istWeekdayMon0,
  parseIstNoon,
  ymdInIst,
  type InternWorkItem,
  type WeekChipKind,
} from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';

/* Four kinds, four tones, each named next to its swatch: danger for a statutory
   filing, brand for a step deadline, the orange highlight for a nudge that needs
   the lead, positive for done. */
const LEGEND: { kind: WeekChipKind; label: string; swatch: string }[] = [
  { kind: 'filing', label: 'Statutory filing', swatch: 'bg-danger' },
  { kind: 'step', label: 'Step deadline', swatch: 'bg-brand' },
  { kind: 'nudge', label: 'Reminder due', swatch: 'bg-warning' },
  { kind: 'done', label: 'Done', swatch: 'bg-positive' },
];

export function LeadWeekStrip({
  items,
  now,
  selectedYmd,
  onSelectDay,
}: {
  items: InternWorkItem[];
  now: Date;
  selectedYmd?: string | null;
  onSelectDay?: (ymd: string) => void;
}) {
  const days = istWeekYmds(now, 7);
  const today = ymdInIst(now);
  const empty = days.every((ymd) =>
    WEEK_CHIP_KIND_ORDER.every((kind) => internWeekDayCounts(items, ymd, today)[kind] === 0),
  );

  return (
    <DashSection icon={CalendarDays} title="This week" meta="Mon–Sun · IST">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((ymd) => {
          const heading = formatIstWeekdayDay(ymd);
          const isToday = ymd === today;
          const isPast = ymd < today;
          const selected = selectedYmd === ymd;
          const weekend = istWeekdayMon0(parseIstNoon(ymd)) >= 5;
          const counts = internWeekDayCounts(items, ymd, today);
          const chips = internWeekChipsForDay(items, ymd, today, 8);
          const total = WEEK_CHIP_KIND_ORDER.reduce((sum, kind) => sum + counts[kind], 0);
          const heavy = counts.filing > 0;
          const titles = chips.map((c) => (c.kind === 'done' ? `${c.label} · done` : c.label)).join('\n');
          return (
            <div key={ymd} className="min-w-0">
              <div
                className={cn(
                  'mb-1.5 px-0.5 py-1 text-center text-[11px] font-semibold leading-tight text-ink-muted',
                  isPast && 'opacity-50',
                  isToday && 'rounded-md bg-brand py-1 text-on-brand',
                  heavy && !isToday && 'text-danger',
                )}
              >
                <span className="block truncate">{heading.weekday}</span>
                <span className="block tabular-nums">{heading.day}</span>
              </div>
              <button
                type="button"
                onClick={() => onSelectDay?.(ymd)}
                aria-pressed={selected}
                aria-label={`${heading.label}${total ? `, ${total} item${total === 1 ? '' : 's'}` : ', no items'}`}
                title={titles || undefined}
                className={cn(
                  'flex min-h-14 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-md bg-surface-sunken p-1 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                  isPast && 'opacity-55',
                  isToday && 'bg-brand-soft outline outline-2 outline-offset-[-2px] outline-brand',
                  selected && 'ring-2 ring-focus-ring ring-offset-1 ring-offset-surface-raised',
                  weekend && !isToday && 'border border-line-soft bg-transparent',
                )}
              >
                {total === 0 ? (
                  <span className="sr-only">No items</span>
                ) : (
                  <>
                    <span className="flex max-w-full flex-wrap items-center justify-center gap-1" aria-hidden>
                      {chips.map((c, i) => (
                        <i
                          key={`${c.kind}-${i}`}
                          className={cn('inline-block h-2 w-2 rounded-sm', internToneBg(WEEK_CHIP_TONE[c.kind]))}
                        />
                      ))}
                    </span>
                    <span
                      className={cn(
                        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm px-1 text-[10px] font-semibold tabular-nums text-on-status',
                        counts.done === total ? 'bg-positive' : 'bg-brand',
                      )}
                    >
                      {total}
                    </span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] font-medium text-ink-muted">
        {LEGEND.map((row) => (
          <span key={row.kind} className="inline-flex items-center gap-1.5">
            <i className={cn('inline-block h-2 w-2 rounded-sm', row.swatch)} />
            {row.label}
          </span>
        ))}
        {selectedYmd ? (
          <Link
            href={internWorkPath({ day: selectedYmd, view: 'tl' })}
            className="ml-auto font-semibold text-brand hover:text-brand-strong hover:underline"
          >
            Open in My work →
          </Link>
        ) : null}
      </div>
      {empty ? (
        <p className="mt-2 text-[12px] text-ink-muted">
          {items.length === 0
            ? 'No assigned work yet. Deadlines will show here by IST day.'
            : 'Nothing lands on this IST week. Overdue and undated open work appears on today.'}
        </p>
      ) : null}
    </DashSection>
  );
}
