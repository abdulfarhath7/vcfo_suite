'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { internToneBg } from '@/components/intern/intern-tones';
import {
  internWeekChipsForDay,
  istWeekYmds,
  istWeekdayMon0,
  parseIstNoon,
  ymdInIst,
  type InternWorkItem,
} from '@/lib/intern-work';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function LeadWeekStrip({ items, now }: { items: InternWorkItem[]; now: Date }) {
  const days = istWeekYmds(now, 7);
  const today = ymdInIst(now);

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-white">
          <CalendarDays className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">This week</h2>
        <span className="ml-auto text-[11.5px] font-semibold text-text-tertiary">Mon–Sun · IST</span>
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((ymd) => {
            const d = parseIstNoon(ymd);
            const isToday = ymd === today;
            const isPast = ymd < today;
            const weekend = istWeekdayMon0(d) >= 5;
            const chips = internWeekChipsForDay(items, ymd, today, 3);
            const heavy = chips.some((c) => c.kind === 'filing');
            return (
              <div key={ymd} className="min-w-0">
                <div
                  className={cn(
                    'mb-1.5 px-0.5 py-1 text-center text-[11px] font-bold text-text-tertiary',
                    isPast && 'opacity-50',
                    isToday && 'rounded-lg bg-primary py-1 text-white',
                    heavy && !isToday && 'text-danger-text',
                  )}
                >
                  {format(d, 'EEE d')}
                </div>
                <div
                  className={cn(
                    'flex min-h-16 flex-col gap-1 rounded-md bg-raised p-1',
                    isPast && 'opacity-55',
                    isToday && 'bg-primary-light outline outline-2 outline-offset-[-2px] outline-primary',
                    weekend && !isToday && 'border border-dashed border-border bg-transparent',
                  )}
                >
                  {chips.map((chip) => (
                    <Link
                      key={chip.id}
                      href={chip.href}
                      className={cn(
                        'truncate rounded-md px-1.5 py-0.5 text-center text-[10px] font-extrabold text-white',
                        internToneBg(chip.tone),
                        chip.kind === 'done' && 'line-through opacity-80',
                      )}
                      title={chip.kind === 'done' ? `${chip.label} · done` : chip.label}
                    >
                      {chip.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3.5 text-[11px] font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-danger" /> Statutory filing
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-primary" /> Step deadline
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-accent-pink" /> Nudge due
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-success" /> Done
          </span>
        </div>
      </div>
    </section>
  );
}
