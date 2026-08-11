"use client";

import { useMemo, useState } from 'react';
import { m } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCheck, FilterX, Sparkles } from 'lucide-react';
import type { Engagement } from '@/data/engagements';
import {
  ACT_META,
  FY_LABEL,
  STATUTORY_DEADLINES,
  deadlineAppliesTo,
  type StatutoryAct,
  type StatutoryDeadline,
} from '@/data/statutory-calendar-fy2627';
import { TONE_BADGE, TONE_BG } from '@/components/common/IconChip';
import { cn } from '@/lib/utils';

const ACTS = Object.keys(ACT_META) as StatutoryAct[];

const FY_FIRST_MONTH = new Date(2026, 3, 1); // Apr 2026
const FY_LAST_MONTH = new Date(2027, 2, 1); // Mar 2027

function monthKey(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

function toIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function clampToFy(d: Date): Date {
  const k = monthKey(d);
  if (k < monthKey(FY_FIRST_MONTH)) return FY_FIRST_MONTH;
  if (k > monthKey(FY_LAST_MONTH)) return FY_LAST_MONTH;
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function StatutoryCalendar({ engagements }: { engagements: Engagement[] }) {
  const todayIso = toIso(new Date());
  const [viewMonth, setViewMonth] = useState(() => clampToFy(new Date()));
  const [companyId, setCompanyId] = useState<string>('all');
  const [mutedActs, setMutedActs] = useState<Set<StatutoryAct>>(new Set());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const company = companyId === 'all' ? null : engagements.find((e) => e.id === companyId) ?? null;

  /* All deadlines that survive the company + act filters, full FY. */
  const applicable = useMemo(() => {
    return STATUTORY_DEADLINES.filter((d) => {
      if (mutedActs.has(d.act)) return false;
      if (company) return deadlineAppliesTo(d, company);
      return true;
    });
  }, [company, mutedActs]);

  const monthPrefix = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthItems = useMemo(
    () => applicable.filter((d) => d.date.startsWith(monthPrefix)),
    [applicable, monthPrefix],
  );

  /* date → items (for grid dots + agenda groups) */
  const byDate = useMemo(() => {
    const map = new Map<string, StatutoryDeadline[]>();
    for (const item of monthItems) {
      const list = map.get(item.date);
      if (list) list.push(item);
      else map.set(item.date, [item]);
    }
    return map;
  }, [monthItems]);

  const agendaDates = useMemo(() => {
    const dates = [...byDate.keys()].sort();
    return selectedDay ? dates.filter((d) => d === selectedDay) : dates;
  }, [byDate, selectedDay]);

  /* Per-act counts for the legend chips (before act muting, after company). */
  const actCounts = useMemo(() => {
    const counts = {} as Record<StatutoryAct, number>;
    for (const act of ACTS) counts[act] = 0;
    for (const d of STATUTORY_DEADLINES) {
      if (!d.date.startsWith(monthPrefix)) continue;
      if (company && !deadlineAppliesTo(d, company)) continue;
      counts[d.act] += 1;
    }
    return counts;
  }, [company, monthPrefix]);

  /* Calendar grid cells: leading blanks + days of month. */
  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      out.push({ iso: toIso(new Date(year, month, day)), day });
    }
    return out;
  }, [viewMonth]);

  const canPrev = monthKey(viewMonth) > monthKey(FY_FIRST_MONTH);
  const canNext = monthKey(viewMonth) < monthKey(FY_LAST_MONTH);

  function shiftMonth(delta: number) {
    setViewMonth((d) => clampToFy(new Date(d.getFullYear(), d.getMonth() + delta, 1)));
    setSelectedDay(null);
  }

  function toggleAct(act: StatutoryAct) {
    setMutedActs((prev) => {
      const next = new Set(prev);
      if (next.has(act)) next.delete(act);
      else next.add(act);
      return next;
    });
  }

  const monthLabel = viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="surface overflow-hidden">
      {/* ── Header: title, company filter ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 mr-1">
          <div className="text-[13px] font-semibold text-ink">Statutory calendar</div>
          <span className="mono rounded bg-primary-light px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary-dark">
            {FY_LABEL}
          </span>
        </div>
        <select
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            setSelectedDay(null);
          }}
          className="h-7 rounded-md border border-border bg-surface px-2 text-[11.5px] text-ink"
        >
          <option value="all">All companies — full calendar</option>
          {engagements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.companyName}
            </option>
          ))}
        </select>
        <p className="ml-auto flex items-center gap-1.5 text-[11px] text-text-tertiary">
          <Sparkles className="h-3 w-3" aria-hidden />
          {company
            ? `Showing compliances applicable to ${company.companyName} (from company profile)`
            : 'Applicability per company is set from its profile — refined at project creation'}
        </p>
      </div>

      {/* ── Act legend chips (click to mute/unmute) ── */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
        {ACTS.map((act) => {
          const meta = ACT_META[act];
          const muted = mutedActs.has(act);
          const count = actCounts[act];
          return (
            <button
              key={act}
              type="button"
              onClick={() => toggleAct(act)}
              title={meta.full}
              className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[10.5px] font-semibold transition-all',
                muted
                  ? 'bg-muted/60 text-text-tertiary opacity-55'
                  : TONE_BADGE[meta.tone],
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full', muted ? 'bg-text-tertiary' : TONE_BG[meta.tone])}
                aria-hidden
              />
              {meta.label}
              <span className="mono tabular-nums font-normal opacity-70">{count}</span>
            </button>
          );
        })}
        {/* Master toggle — adapts to state so it always has one useful action */}
        {mutedActs.size > 0 ? (
          <button
            type="button"
            onClick={() => setMutedActs(new Set())}
            className="ml-auto inline-flex h-6 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-light px-2.5 text-[10.5px] font-semibold text-primary-dark transition-colors hover:border-primary/50"
          >
            <CheckCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            Select all
            <span className="mono rounded-full bg-primary/15 px-1 py-px text-[9px] font-bold tabular-nums">
              {mutedActs.size} off
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMutedActs(new Set(ACTS))}
            className="ml-auto inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-[10.5px] font-medium text-muted-foreground transition-colors hover:border-role/40 hover:text-foreground"
          >
            <FilterX className="h-3 w-3" strokeWidth={2} aria-hidden />
            Clear all
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-[minmax(300px,340px)_1fr]">
        {/* ── Month grid ── */}
        <div className="border-b border-border bg-muted/20 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!canPrev}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground disabled:opacity-35"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="font-serif text-[13.5px] font-semibold text-ink">{monthLabel}</div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={!canNext}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground disabled:opacity-35"
              aria-label="Next month"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 rounded-lg border border-border bg-surface p-2">
            {WEEKDAYS.map((w, i) => (
              <div
                key={`${w}-${i}`}
                className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase text-text-tertiary"
              >
                {w}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (!cell) return <div key={`blank-${i}`} />;
              const items = byDate.get(cell.iso);
              const acts = items ? [...new Set(items.map((x) => x.act))] : [];
              const isToday = cell.iso === todayIso;
              const isSelected = cell.iso === selectedDay;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={!items}
                  onClick={() => setSelectedDay((d) => (d === cell.iso ? null : cell.iso))}
                  className={cn(
                    'relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-lg text-[12px] tabular-nums transition-colors',
                    items ? 'font-medium text-ink hover:bg-role-soft/50' : 'text-text-tertiary/70',
                    isSelected && 'bg-role-soft text-role-foreground',
                    isToday && !isSelected && 'ring-1 ring-role/50',
                  )}
                  title={items ? `${items.length} deadline${items.length > 1 ? 's' : ''}` : undefined}
                >
                  {cell.day}
                  {acts.length > 0 && (
                    <span className="mt-0.5 flex items-center gap-[3px]" aria-hidden>
                      {acts.slice(0, 3).map((act) => (
                        <span
                          key={act}
                          className={cn('h-[5px] w-[5px] rounded-full', TONE_BG[ACT_META[act].tone])}
                        />
                      ))}
                      {acts.length > 3 && (
                        <span className="text-[7px] font-bold leading-none text-text-tertiary">
                          +{acts.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-center text-[11px] text-text-tertiary">
            <span className="tabular-nums font-medium text-ink">{monthItems.length}</span> deadline
            {monthItems.length === 1 ? '' : 's'} in {monthLabel}
            {selectedDay ? ' · day selected' : ''}
          </p>
        </div>

        {/* ── Agenda ── */}
        <div className="min-w-0">
          {selectedDay && (
            <div className="flex items-center justify-between border-b border-border bg-role-soft/40 px-4 py-2">
              <span className="text-[11.5px] font-medium text-role-foreground">
                {new Date(`${selectedDay}T00:00:00`).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })}
              </span>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-[11px] font-medium text-role-foreground/80 hover:text-role-foreground"
              >
                Show full month
              </button>
            </div>
          )}

          {agendaDates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
              <CalendarDays className="h-8 w-8 text-text-tertiary/60" aria-hidden />
              <p className="max-w-sm text-[13px] text-muted-foreground">
                No statutory deadlines match the current filters in {monthLabel}.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {agendaDates.map((dateIso) => {
                const items = byDate.get(dateIso) ?? [];
                const d = new Date(`${dateIso}T00:00:00`);
                const isPast = dateIso < todayIso;
                const isToday = dateIso === todayIso;
                return (
                  <div key={dateIso} className={cn('flex gap-4 px-4 py-3', isPast && 'opacity-55')}>
                    {/* date rail */}
                    <div className="w-11 shrink-0 pt-0.5 text-center">
                      <div
                        className={cn(
                          'font-serif text-[19px] font-semibold leading-none tabular-nums',
                          isToday ? 'text-role-foreground' : 'text-ink',
                        )}
                      >
                        {d.getDate()}
                      </div>
                      <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                        {isToday ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </div>
                    </div>
                    {/* items */}
                    <div className="min-w-0 flex-1 space-y-1">
                      {items.map((item, i) => {
                        const meta = ACT_META[item.act];
                        return (
                          <m.div
                            key={item.id}
                            initial={{ opacity: 0, y: 3 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.02 * i }}
                            className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40"
                          >
                            <span
                              className={cn(
                                'mt-px inline-flex w-[4.5rem] shrink-0 justify-center rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide',
                                TONE_BADGE[meta.tone],
                              )}
                              title={meta.full}
                            >
                              {meta.label}
                            </span>
                            <span className="min-w-0 text-[12.5px] leading-snug text-ink-soft">
                              {item.title}
                            </span>
                          </m.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
