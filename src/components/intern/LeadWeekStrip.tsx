'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
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
} from '@/lib/intern-work';
import { cn } from '@/lib/utils';

const LEGEND: { kind: WeekChipKind; label: string; swatch: string }[] = [
  { kind: 'filing', label: 'Statutory filing', swatch: 'bg-danger' },
  { kind: 'step', label: 'Step deadline', swatch: 'bg-primary' },
  { kind: 'nudge', label: 'Nudge due', swatch: 'bg-accent-pink' },
  { kind: 'done', label: 'Done', swatch: 'bg-success' },
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

  return (
    <section className="surface overflow-hidden">
      <div className="flex min-w-0 items-center gap-2.5 px-4 pt-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-white">
          <CalendarDays className="h-3.5 w-3.5" />
        </span>
        <h2 className="min-w-0 truncate text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">This week</h2>
        <span className="ml-auto shrink-0 text-[11.5px] font-semibold text-text-tertiary">Mon–Sun · IST</span>
      </div>
      <div className="px-4 pb-3 pt-2.5">
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
                    'mb-1.5 px-0.5 py-1 text-center text-[11px] font-bold leading-tight text-text-tertiary',
                    isPast && 'opacity-50',
                    isToday && 'rounded-lg bg-primary py-1 text-white',
                    heavy && !isToday && 'text-danger-text',
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
                    'flex min-h-14 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-md bg-raised p-1',
                    isPast && 'opacity-55',
                    isToday && 'bg-primary-light outline outline-2 outline-offset-[-2px] outline-primary',
                    selected && 'ring-2 ring-primary ring-offset-1 ring-offset-panel',
                    weekend && !isToday && 'border border-dashed border-border bg-transparent',
                  )}
                >
                  {total === 0 ? (
                    <span className="sr-only">No items</span>
                  ) : (
                    <span className="flex max-w-full flex-wrap items-center justify-center gap-0.5">
                      {WEEK_CHIP_KIND_ORDER.map((kind) => {
                        const n = counts[kind];
                        if (!n) return null;
                        return (
                          <span
                            key={kind}
                            className={cn(
                              'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded px-1 text-[10px] font-extrabold tabular-nums text-white',
                              internToneBg(WEEK_CHIP_TONE[kind]),
                            )}
                          >
                            {n}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] font-bold text-muted-foreground">
          {LEGEND.map((row) => (
            <span key={row.kind} className="inline-flex items-center gap-1.5">
              <i className={cn('inline-block h-2 w-2 rounded-sm', row.swatch)} />
              {row.label}
            </span>
          ))}
          {selectedYmd ? (
            <Link
              href={internWorkPath({ day: selectedYmd, view: 'tl' })}
              className="ml-auto font-extrabold text-primary hover:underline"
            >
              Open in My work →
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
