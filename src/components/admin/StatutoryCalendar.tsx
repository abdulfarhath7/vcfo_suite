"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { m, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCheck, ListChecks } from 'lucide-react';
import type { Engagement } from '@/data/engagements';
import {
  ACT_META,
  ACT_SWATCH,
  FY_LABEL,
  STATUTORY_DEADLINES,
  deadlineAppliesTo,
  type StatutoryAct,
  type StatutoryDeadline,
} from '@/data/statutory-calendar-fy2627';
import { CompanyPicker } from '@/components/admin/CompanyPicker';
import {
  dateHasAgendaItems,
  isSelectAllActive,
  selectAllActs,
  statutoryAgendaId,
  toggleMutedAct,
} from '@/components/admin/statutory-calendar-utils';
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
const FLASH_MS = 1400;

export function StatutoryCalendar({
  engagements,
  trackerHref,
}: {
  engagements: Engagement[];
  /** Intern-only: filing tracker lives on its own route, not page tabs. */
  trackerHref?: string;
}) {
  const todayIso = toIso(new Date());
  const reduceMotion = useReducedMotion();
  const [viewMonth, setViewMonth] = useState(() => clampToFy(new Date()));
  const [companyId, setCompanyId] = useState<string>('all');
  const [mutedActs, setMutedActs] = useState<Set<StatutoryAct>>(() => selectAllActs());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [flashDay, setFlashDay] = useState<string | null>(null);
  const agendaScrollRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const company = companyId === 'all' ? null : engagements.find((e) => e.id === companyId) ?? null;
  const selectAllOn = isSelectAllActive(mutedActs);

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

  const byDate = useMemo(() => {
    const map = new Map<string, StatutoryDeadline[]>();
    for (const item of monthItems) {
      const list = map.get(item.date);
      if (list) list.push(item);
      else map.set(item.date, [item]);
    }
    return map;
  }, [monthItems]);

  const agendaDates = useMemo(() => [...byDate.keys()].sort(), [byDate]);

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

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  function shiftMonth(delta: number) {
    setViewMonth((d) => clampToFy(new Date(d.getFullYear(), d.getMonth() + delta, 1)));
    setSelectedDay(null);
    setFlashDay(null);
  }

  function jumpToDay(iso: string) {
    if (!dateHasAgendaItems(iso, byDate)) return;
    setSelectedDay(iso);
    setFlashDay(iso);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      setFlashDay((d) => (d === iso ? null : d));
    }, FLASH_MS);

    const el = document.getElementById(statutoryAgendaId(iso));
    const parent = agendaScrollRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
    if (parent && parent.contains(el)) {
      const parentRect = parent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      parent.scrollTo({
        top: parent.scrollTop + (elRect.top - parentRect.top) - 6,
        behavior,
      });
      return;
    }
    el.scrollIntoView({ behavior, block: 'start' });
  }

  const monthLabel = viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 mr-1">
          <div className="text-[13px] font-semibold text-ink">Statutory calendar</div>
          <span className="mono rounded bg-primary-light px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary-dark">
            {FY_LABEL}
          </span>
        </div>
        <CompanyPicker
          engagements={engagements}
          value={companyId}
          onChange={(id) => {
            setCompanyId(id);
            setSelectedDay(null);
          }}
        />
        {trackerHref ? (
          <Link
            href={trackerHref}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-role-foreground transition-colors hover:bg-role-soft"
          >
            <ListChecks className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Filing tracker
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
        <button
          type="button"
          aria-pressed={selectAllOn}
          onClick={() => setMutedActs(selectAllActs())}
          className={cn(
            'inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[10.5px] font-semibold transition-all',
            selectAllOn
              ? 'bg-role-soft text-role-foreground ring-1 ring-role/25'
              : 'bg-muted/60 text-text-tertiary opacity-70 hover:opacity-100',
          )}
        >
          <CheckCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden />
          Select all
        </button>
        {ACTS.map((act) => {
          const meta = ACT_META[act];
          const muted = mutedActs.has(act);
          const count = actCounts[act];
          return (
            <button
              key={act}
              type="button"
              onClick={() => setMutedActs((prev) => toggleMutedAct(prev, act))}
              title={meta.full}
              aria-pressed={!muted}
              className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[10.5px] font-semibold transition-all',
                muted
                  ? 'bg-muted/60 text-text-tertiary opacity-55'
                  : ACT_SWATCH[act].chip,
              )}
            >
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', muted ? 'bg-text-tertiary' : ACT_SWATCH[act].solid)}
                aria-hidden
              />
              {meta.label}
              <span className="mono tabular-nums font-normal opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[minmax(300px,340px)_1fr]">
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

          <div className="grid grid-cols-7 gap-1 rounded-lg border border-border bg-surface p-2">
            {WEEKDAYS.map((w, i) => (
              <div
                key={`${w}-${i}`}
                className="flex h-6 items-center justify-center text-[10px] font-semibold uppercase text-text-tertiary"
              >
                {w}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (!cell) return <div key={`blank-${i}`} />;
              const items = byDate.get(cell.iso);
              const acts = items ? [...new Set(items.map((x) => x.act))] : [];
              const hasItems = Boolean(items && items.length > 0);
              const isToday = cell.iso === todayIso;
              const isSelected = cell.iso === selectedDay;
              const washAct = acts.length === 1 ? acts[0] : null;
              const dayNum = (
                <span
                  className={cn(
                    'relative z-10 flex h-7 w-7 items-center justify-center text-[12px] tabular-nums',
                    isToday && 'rounded-full bg-role font-semibold text-white shadow-sm',
                    !isToday && hasItems && 'font-semibold text-ink',
                    !isToday && !hasItems && 'text-text-tertiary/70',
                  )}
                >
                  {cell.day}
                </span>
              );

              const cellInner = (
                <>
                  {washAct ? (
                    <span
                      className={cn('absolute inset-0 rounded-md', ACT_SWATCH[washAct].soft)}
                      aria-hidden
                    />
                  ) : null}
                  {acts.length > 0 ? (
                    <span
                      className="absolute inset-y-1 left-0.5 z-10 flex w-1 flex-col gap-px overflow-hidden rounded-full bg-surface"
                      aria-hidden
                    >
                      {acts.map((act) => (
                        <span key={act} className={cn('min-h-[4px] w-full flex-1', ACT_SWATCH[act].solid)} />
                      ))}
                    </span>
                  ) : null}
                  {hasItems && items && items.length > 1 ? (
                    <span className="absolute right-0.5 top-0.5 z-10 mono rounded-sm bg-surface/80 px-0.5 text-[8px] font-bold tabular-nums leading-none text-ink/80">
                      {items.length}
                    </span>
                  ) : null}
                  {dayNum}
                </>
              );

              if (!hasItems) {
                return (
                  <div
                    key={cell.iso}
                    className={cn(
                      'relative flex h-11 items-center justify-center rounded-md',
                      isToday && 'ring-1 ring-role/40',
                    )}
                  >
                    {dayNum}
                  </div>
                );
              }

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => jumpToDay(cell.iso)}
                  className={cn(
                    'relative flex h-11 w-full items-center justify-center overflow-hidden rounded-md transition-colors hover:brightness-[0.97]',
                    isSelected && 'ring-2 ring-role/55',
                    isToday && !isSelected && 'ring-1 ring-role/40',
                  )}
                  aria-label={`${cell.day} ${monthLabel}, ${items!.length} deadline${items!.length === 1 ? '' : 's'}`}
                  title={`${items!.length} deadline${items!.length === 1 ? '' : 's'}`}
                >
                  {cellInner}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-center text-[11px] text-text-tertiary">
            <span className="tabular-nums font-medium text-ink">{monthItems.length}</span> deadline
            {monthItems.length === 1 ? '' : 's'} in {monthLabel}
          </p>
        </div>

        <div
          ref={agendaScrollRef}
          className="min-w-0 max-h-[min(70vh,40rem)] overflow-y-auto scroll-smooth"
        >
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
                const flashing = flashDay === dateIso;
                return (
                  <div
                    key={dateIso}
                    id={statutoryAgendaId(dateIso)}
                    className={cn(
                      'flex scroll-mt-2 gap-4 px-4 py-3 transition-colors duration-500',
                      isPast && !flashing && 'opacity-55',
                      flashing && 'bg-role-soft/80 ring-1 ring-inset ring-role/30',
                    )}
                  >
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
                                ACT_SWATCH[item.act].chip,
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
