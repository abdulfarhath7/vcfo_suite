"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ListChecks, Maximize2 } from 'lucide-react';
import type { Engagement } from '@/data/engagements';
import { useApp } from '@/context/AppContext';
import { isFirmWideAdmin } from '@/lib/auth';
import {
  ACT_META,
  ACT_ORDER,
  FY_END,
  FY_LABEL,
  FY_START,
  STATUTORY_DEADLINES,
  deadlineAppliesTo,
  type StatutoryAct,
  type StatutoryDeadline,
} from '@/data/statutory-calendar-fy2627';
import { CompanyPicker } from '@/components/admin/CompanyPicker';
import {
  PreIncorporationNotice,
  PreIncorporationPortfolioNote,
  type PreIncorporationScope,
} from '@/components/compliances/PreIncorporationNotice';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import { PageBackCluster } from '@/components/shell/PageBackButton';
import {
  buildStatutoryFyMonths,
  buildStatutoryMonthGrid,
  isoFromDate,
  isoInStatutoryFy,
  nextInMonthCellIndex,
  readCalendarViewPrefs,
  statutoryAgendaId,
  statutoryFilingName,
  statutoryMonthPrefix,
  statutoryReturnPeriod,
  statutoryStatus,
  statutoryStatusLabel,
  toggleMutedAct,
  writeCalendarViewPrefs,
  type StatutoryCalendarMode,
  type StatutoryMonthCell,
  type StatutoryStatus,
} from '@/components/admin/statutory-calendar-utils';
import { StatutoryMaxiCalendar } from '@/components/admin/StatutoryMaxiCalendar';
import { StatutoryYearGrid } from '@/components/admin/StatutoryYearGrid';
import { monthPaneMotion } from '@/lib/motion';
import { useShellAppearance } from '@/lib/use-shell-appearance';
import { cn } from '@/lib/utils';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const FY_FIRST_MONTH = new Date(2026, 3, 1);
const FY_LAST_MONTH = new Date(2027, 2, 1);
const FLASH_MS = 1400;
const EMPTY_ITEMS: StatutoryDeadline[] = [];

type Scope = 'all' | 'overdue';
type ViewMode = 'month' | 'year';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
];

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

/** Status is the calendar's ONLY colour lane — see the `.cal-*` colour
    contract at the top of the calendar block in `app/globals.css`. */
const STATUS_CLASS: Record<StatutoryStatus, string> = {
  overdue: 'is-overdue',
  'due-soon': 'is-due-soon',
  upcoming: 'is-upcoming',
};

function monthKey(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

function clampToFy(d: Date): Date {
  const k = monthKey(d);
  if (k < monthKey(FY_FIRST_MONTH)) return FY_FIRST_MONTH;
  if (k > monthKey(FY_LAST_MONTH)) return FY_LAST_MONTH;
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function parseLocalIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function deadlineLabel(n: number): string {
  return n === 1 ? '1 deadline' : `${n} deadlines`;
}

/** Worst state on a day decides its marker — one overdue outranks ten upcoming. */
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

function StatutoryDayTile({
  cell,
  items,
  todayIso,
  selected,
  focused,
  monthLabel,
  onSelect,
}: {
  cell: StatutoryMonthCell;
  items: readonly StatutoryDeadline[];
  todayIso: string;
  selected: boolean;
  focused: boolean;
  monthLabel: string;
  onSelect: (iso: string) => void;
}) {
  const inFy = isoInStatutoryFy(cell.iso, FY_START, FY_END);
  const isToday = cell.iso === todayIso;

  if (!inFy || !cell.inMonth) {
    return (
      <div role="gridcell" className="cal-day is-outside" aria-hidden>
        <span className="cal-day-num">{cell.day}</span>
        <span className="cal-mark is-empty" />
      </div>
    );
  }

  const local = parseLocalIso(cell.iso);
  const weekday = local.toLocaleDateString('en-IN', { weekday: 'long' });
  const status = worstStatus(items, todayIso);

  return (
    <button
      type="button"
      role="gridcell"
      data-cal-iso={cell.iso}
      tabIndex={focused ? 0 : -1}
      aria-current={isToday ? 'date' : undefined}
      aria-selected={selected}
      aria-label={`${weekday} ${cell.day} ${monthLabel}${
        items.length ? `, ${deadlineLabel(items.length)}` : ''
      }`}
      onClick={() => onSelect(cell.iso)}
      className="cal-day"
      data-today={isToday ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
    >
      <span className="cal-day-num">{cell.day}</span>
      <span
        className={cn(
          'cal-mark',
          status === null && 'is-empty',
          status === 'due-soon' && 'is-due-soon',
          status === 'overdue' && 'is-overdue',
        )}
        aria-hidden
      >
        {items.length || ''}
      </span>
    </button>
  );
}

function StatutoryListRow({ item, todayIso }: { item: StatutoryDeadline; todayIso: string }) {
  const meta = ACT_META[item.act];
  const status = statutoryStatus(item.date, todayIso);
  const period = statutoryReturnPeriod(item.title);
  const d = parseLocalIso(item.date);

  return (
    <li className="cal-row">
      <span className="cal-row-date" aria-hidden>
        <span className="cal-row-day">{d.getDate()}</span>
        <span className="cal-row-dow">
          {d.toLocaleDateString('en-IN', { weekday: 'short' })}
        </span>
      </span>
      <span className="cal-row-main">
        <span className="cal-row-title">{statutoryFilingName(item.title)}</span>
        <span className="cal-row-meta">
          <span className="cal-tag mono" title={meta.full}>
            {meta.label}
          </span>
          {period ? <span className="cal-period-tag">{period}</span> : null}
        </span>
      </span>
      <span className={cn('cal-status', STATUS_CLASS[status])}>
        {statutoryStatusLabel(item.date, todayIso)}
      </span>
    </li>
  );
}

function StatutoryAgendaGroup({
  dateIso,
  items,
  todayIso,
  selected,
  flashing,
  reduceMotion,
}: {
  dateIso: string;
  items: readonly StatutoryDeadline[];
  todayIso: string;
  selected: boolean;
  flashing: boolean;
  reduceMotion: boolean;
}) {
  const d = parseLocalIso(dateIso);
  const isPast = dateIso < todayIso;
  const isToday = dateIso === todayIso;
  return (
    <section
      id={statutoryAgendaId(dateIso)}
      className={cn(
        'cal-group',
        selected && 'is-selected',
        flashing && 'is-flash',
        isPast && !selected && !flashing && 'is-past',
        !reduceMotion && 'cal-group-motion',
      )}
    >
      <header className="cal-group-head">
        <span className={cn('cal-group-label', isToday && 'is-today')}>
          {isToday
            ? 'Today'
            : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
        <span className="cal-group-n">{items.length}</span>
      </header>
      <ul className="cal-rows">
        {items.map((item) => (
          <StatutoryListRow key={item.id} item={item} todayIso={todayIso} />
        ))}
      </ul>
    </section>
  );
}

/**
 * COMPLIANCE CALENDAR — the SBC master statutory calendar, FY 2026-27.
 *
 * Two views over one dataset:
 *   Month — a day grid beside the month as an agenda, which is the working
 *           view: what is due, when, under which act.
 *   Year  — twelve month cards, which is the planning view: which months are
 *           heavy. Picking a card drops back into Month on it.
 *
 * COLOUR. The page runs one colour lane: urgency. Overdue is the only strong
 * colour on screen, due-soon is amber, and upcoming carries no hue at all.
 * The eight acts are told apart by their mono code tag, never by a swatch —
 * see the contract comment above the `.cal-*` block in `app/globals.css`.
 */
export function StatutoryCalendar({
  engagements,
  trackerHref,
  showBack,
  companyId: controlledCompanyId,
  onCompanyChange,
  month: controlledMonth,
  onMonthChange,
  audience = 'staff',
}: {
  engagements: Engagement[];
  /** Intern-only: filing tracker lives on its own route, not page tabs. */
  trackerHref?: string;
  /** Place the shell back chevron beside the section title (intern calendar). */
  showBack?: boolean;
  /**
   * Controlled company selection (`'all'` or an engagement id). When set, the
   * picker inside this calendar drives the caller too, so one choice narrows
   * the calendar and the register together. Omit to keep it self-contained.
   */
  companyId?: string;
  onCompanyChange?: (id: string) => void;
  /**
   * Controlled month, same bargain as `companyId`. The page below this grid
   * shows the register for the month in view, so stepping the calendar has to
   * carry the whole page with it — otherwise the toolbar says September and
   * the filings under it still say August.
   */
  month?: Date;
  onMonthChange?: (month: Date) => void;
  /** Wording of the pre-COI notice for a narrowed company. */
  audience?: PreIncorporationScope['audience'];
}) {
  const todayIso = isoFromDate(new Date());
  const monthHeadingId = useId();
  const gridHintId = useId();
  const osReduce = useReducedMotion();
  const { reduceMotion: prefReduce } = useShellAppearance();
  const reduceMotion = Boolean(osReduce) || prefReduce;
  const [ownMonth, setOwnMonth] = useState(() => clampToFy(controlledMonth ?? new Date()));
  const viewMonth = controlledMonth ? clampToFy(controlledMonth) : ownMonth;
  const setViewMonth = (next: Date) => {
    const clamped = clampToFy(next);
    if (controlledMonth === undefined) setOwnMonth(clamped);
    onMonthChange?.(clamped);
  };
  const [view, setView] = useState<ViewMode>('month');
  const [mode, setMode] = useState<StatutoryCalendarMode>('minimized');
  const { sidebarMode, setSidebarMode, user, getStateForEngagement } = useApp();
  /** Admin and super see the full master calendar; leads and managers only the
      deadlines that apply to a client in their own scoped portfolio. */
  const firmWide = isFirmWideAdmin(user?.role);
  /** True when maximizing unpinned the sidebar — minimize must re-pin it. */
  const unpinnedForMax = useRef(false);

  const unpinSidebarForMax = () => {
    if (sidebarMode === 'open') {
      unpinnedForMax.current = true;
      setSidebarMode('auto');
    }
  };
  const restoreSidebarAfterMax = () => {
    if (unpinnedForMax.current) {
      unpinnedForMax.current = false;
      setSidebarMode('open');
    }
  };

  useEffect(() => {
    if (readCalendarViewPrefs().mode === 'maximized') {
      setMode('maximized');
      unpinSidebarForMax();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the page while maximized must not strand an unpinned sidebar.
  useEffect(
    () => () => {
      if (unpinnedForMax.current) setSidebarMode('open');
    },
    [setSidebarMode],
  );

  const applyMode = (nextMode: StatutoryCalendarMode) => {
    if (nextMode === 'maximized') unpinSidebarForMax();
    else restoreSidebarAfterMax();
    setMode(nextMode);
    writeCalendarViewPrefs({ mode: nextMode });
  };
  const [monthDir, setMonthDir] = useState<1 | -1>(1);
  const [ownCompanyId, setOwnCompanyId] = useState<string>('all');
  const companyId = controlledCompanyId ?? ownCompanyId;
  const setCompanyId = (id: string) => {
    if (controlledCompanyId === undefined) setOwnCompanyId(id);
    onCompanyChange?.(id);
  };
  const [scope, setScope] = useState<Scope>('all');
  const [mutedActs, setMutedActs] = useState<Set<StatutoryAct>>(() => new Set());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [flashDay, setFlashDay] = useState<string | null>(null);
  const [focusedIso, setFocusedIso] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRequest = useRef<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const company = companyId === 'all' ? null : engagements.find((e) => e.id === companyId) ?? null;
  /** A picker needs a choice; a single-company scope is simply that company. */
  const showPicker = engagements.length > 1;

  /** Pre-COI companies, read off the list in hand — the count needs no query. */
  const preIncorporationCount = useMemo(
    () => engagements.filter((e) => !isIncorporated(e, getStateForEngagement(e))).length,
    [engagements, getStateForEngagement],
  );
  const companyPreIncorporation = Boolean(
    company && !isIncorporated(company, getStateForEngagement(company)),
  );

  /** Company + scope, but before act mutes — filter counts must not vanish. */
  const scoped = useMemo(() => {
    return STATUTORY_DEADLINES.filter((d) => {
      if (company && !deadlineAppliesTo(d, company)) return false;
      if (!firmWide && !company && !engagements.some((e) => deadlineAppliesTo(d, e))) {
        return false;
      }
      if (scope === 'overdue' && statutoryStatus(d.date, todayIso) !== 'overdue') return false;
      return true;
    });
  }, [company, scope, todayIso, firmWide, engagements]);

  const visible = useMemo(() => scoped.filter((d) => !mutedActs.has(d.act)), [scoped, mutedActs]);

  const monthPrefix = statutoryMonthPrefix(viewMonth);

  /** Month view buckets one month; year view needs the whole FY. */
  const byDate = useMemo(() => {
    const map = new Map<string, StatutoryDeadline[]>();
    for (const item of visible) {
      if (view === 'month' && !item.date.startsWith(monthPrefix)) continue;
      const list = map.get(item.date);
      if (list) list.push(item);
      else map.set(item.date, [item]);
    }
    return map;
  }, [visible, monthPrefix, view]);

  /** The agenda is always the month in view, even while the year grid is up. */
  const agendaDates = useMemo(
    () => [...byDate.keys()].filter((iso) => iso.startsWith(monthPrefix)).sort(),
    [byDate, monthPrefix],
  );
  const monthCount = useMemo(
    () => agendaDates.reduce((sum, iso) => sum + (byDate.get(iso)?.length ?? 0), 0),
    [agendaDates, byDate],
  );

  /** Act counts follow the view: this month, or the whole year. */
  const actCounts = useMemo(() => {
    const counts = {} as Record<StatutoryAct, number>;
    for (const act of ACT_ORDER) counts[act] = 0;
    for (const d of scoped) {
      if (view === 'month' && !d.date.startsWith(monthPrefix)) continue;
      counts[d.act] += 1;
    }
    return counts;
  }, [scoped, monthPrefix, view]);

  const fyMonths = useMemo(() => buildStatutoryFyMonths(FY_START, FY_END), []);
  const cells = useMemo(() => buildStatutoryMonthGrid(viewMonth), [viewMonth]);

  const rovingIso =
    focusedIso && cells.some((c) => c.inMonth && c.iso === focusedIso)
      ? focusedIso
      : (cells.find((c) => c.inMonth && c.iso === todayIso)?.iso ??
        cells.find((c) => c.inMonth)?.iso ??
        null);

  const canPrev = monthKey(viewMonth) > monthKey(FY_FIRST_MONTH);
  const canNext = monthKey(viewMonth) < monthKey(FY_LAST_MONTH);
  const monthName = viewMonth.toLocaleDateString('en-IN', { month: 'long' });
  const monthYear = viewMonth.getFullYear();
  const monthLabel = `${monthName} ${monthYear}`;
  const pane = monthPaneMotion(monthDir, reduceMotion);

  function resetDaySelection() {
    setSelectedDay(null);
    setFlashDay(null);
    setFocusedIso(null);
    scrollRequest.current = null;
  }

  function jumpToToday() {
    const next = clampToFy(new Date());
    const delta = monthKey(next) - monthKey(viewMonth);
    setView('month');
    if (delta !== 0) {
      setMonthDir(delta < 0 ? -1 : 1);
      setViewMonth(next);
      resetDaySelection();
    }
  }

  function shiftMonth(delta: number) {
    setMonthDir(delta < 0 ? -1 : 1);
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));
    resetDaySelection();
  }

  function pickMonth(month: Date) {
    const delta = monthKey(month) - monthKey(viewMonth);
    setMonthDir(delta < 0 ? -1 : 1);
    setViewMonth(clampToFy(month));
    setView('month');
    resetDaySelection();
  }

  function jumpToDay(iso: string) {
    if (!isoInStatutoryFy(iso, FY_START, FY_END)) return;
    setSelectedDay(iso);
    setFocusedIso(iso);
    if (!byDate.has(iso)) {
      scrollRequest.current = null;
      setFlashDay(null);
      return;
    }
    setFlashDay(iso);
    scrollRequest.current = iso;
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      setFlashDay((d) => (d === iso ? null : d));
    }, FLASH_MS);
  }

  useEffect(() => {
    const iso = scrollRequest.current;
    if (!iso || iso !== selectedDay) return;
    if (!byDate.has(iso)) return;
    const el = document.getElementById(statutoryAgendaId(iso));
    if (!el) return;
    scrollRequest.current = null;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [selectedDay, byDate, reduceMotion]);

  function onGridKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const iso = (e.target as HTMLElement).dataset.calIso;
    if (!iso) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      jumpToDay(iso);
      return;
    }
    const from = cells.findIndex((c) => c.iso === iso);
    const next = nextInMonthCellIndex(cells, from, e.key);
    if (next == null || next === from) return;
    e.preventDefault();
    const nextIso = cells[next]?.iso;
    if (!nextIso) return;
    setFocusedIso(nextIso);
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLElement>(`[data-cal-iso="${nextIso}"]`)?.focus();
    });
  }

  const title = showBack ? (
    <PageBackCluster>
      <h1 className="text-[1.05rem] font-semibold leading-none tracking-tight text-foreground">
        Statutory calendar
      </h1>
    </PageBackCluster>
  ) : (
    <h2 className="text-[1.05rem] font-semibold leading-none tracking-tight text-foreground">
      Statutory calendar
    </h2>
  );

  return (
    <div className="cal">
      <div className="flex flex-wrap items-center gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2.5">
          {title}
          <span className="mono rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
            {FY_LABEL}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {showPicker ? (
            <CompanyPicker
              engagements={engagements}
              value={companyId}
              onChange={(id) => {
                setCompanyId(id);
                setSelectedDay(null);
              }}
            />
          ) : null}
          {trackerHref ? (
            <Link href={trackerHref} className="cal-ghost">
              <ListChecks className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Filing tracker
            </Link>
          ) : null}
        </div>
      </div>

      {company && companyPreIncorporation ? (
        <PreIncorporationNotice scope={{ audience, companyName: company.companyName }} />
      ) : !company ? (
        <PreIncorporationPortfolioNote count={preIncorporationCount} className="px-1" />
      ) : null}

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="cal-bar">
        <SegmentedPicker
          value={view}
          options={VIEWS.map((v) => ({ value: v.id, label: v.label }))}
          onChange={(next) => {
            setView(next);
            resetDaySelection();
          }}
          ariaLabel="Calendar view"
          size="sm"
          className="shrink-0"
        />

        <div className="cal-bar-group">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={!canPrev}
            className="cal-navbtn"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <p id={monthHeadingId} className="cal-period">
            {view === 'year' ? (
              FY_LABEL
            ) : (
              <>
                {monthName}
                <span className="cal-period-year">{monthYear}</span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={!canNext}
            className="cal-navbtn"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button type="button" onClick={jumpToToday} className="cal-ghost">
            Today
          </button>
        </div>

        <div className="cal-bar-group is-end">
          <SegmentedPicker
            value={scope}
            options={SCOPES.map((s) => ({ value: s.id, label: s.label }))}
            onChange={(next) => {
              setScope(next);
              setSelectedDay(null);
            }}
            ariaLabel="Filter deadlines"
            size="sm"
            className="shrink-0"
          />
          <button type="button" onClick={() => applyMode('maximized')} className="cal-ghost">
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Full screen
          </button>
        </div>
      </div>

      {/* ── Stage ─────────────────────────────────────────────────────── */}
      <div className={cn('cal-stage', view === 'year' && 'is-year')}>
        {view === 'year' ? (
          <StatutoryYearGrid
            months={fyMonths}
            byDate={byDate}
            todayIso={todayIso}
            currentMonth={viewMonth}
            onPickMonth={pickMonth}
          />
        ) : (
          <section className="cal-panel" aria-label={`${monthLabel} grid`}>
            <div className="cal-grid-body">
              <p id={gridHintId} className="sr-only">
                Use arrow keys to move between days. Choose a day to jump to it in the list.
              </p>
              <div className="cal-dows" aria-hidden>
                {WEEKDAYS.map((w, i) => (
                  <div key={`${w}-${i}`} className={cn('cal-dow', (i === 0 || i === 6) && 'is-weekend')}>
                    {w}
                  </div>
                ))}
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={monthPrefix}
                  ref={gridRef}
                  role="grid"
                  aria-labelledby={monthHeadingId}
                  aria-describedby={gridHintId}
                  onKeyDown={onGridKeyDown}
                  initial={pane.initial}
                  animate={pane.animate}
                  exit={pane.exit}
                  transition={pane.transition}
                  className="cal-month"
                >
                  {cells.map((cell) => (
                    <StatutoryDayTile
                      key={cell.iso}
                      cell={cell}
                      items={byDate.get(cell.iso) ?? EMPTY_ITEMS}
                      todayIso={todayIso}
                      selected={cell.iso === selectedDay}
                      focused={cell.iso === rovingIso}
                      monthLabel={monthLabel}
                      onSelect={jumpToDay}
                    />
                  ))}
                </m.div>
              </AnimatePresence>
            </div>

          </section>
        )}

        {view === 'month' ? (
          <section className="cal-panel cal-rail" aria-label={`${monthLabel} deadlines`}>
            <div className="cal-panel-head">
              <h3 className="cal-panel-title">{monthName} deadlines</h3>
              <span className="cal-panel-n">{monthCount}</span>
            </div>
            <div className="cal-rail-body">
              {agendaDates.length === 0 ? (
                <p className="cal-empty">No deadlines in {monthLabel} for these filters.</p>
              ) : (
                agendaDates.map((dateIso) => (
                  <StatutoryAgendaGroup
                    key={dateIso}
                    dateIso={dateIso}
                    items={byDate.get(dateIso) ?? EMPTY_ITEMS}
                    todayIso={todayIso}
                    selected={dateIso === selectedDay}
                    flashing={flashDay === dateIso}
                    reduceMotion={reduceMotion}
                  />
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>

      {/* ── Legend + act filter ───────────────────────────────────────────
          Outside the stage so both views are served by one bar, and so the
          act filter is reachable while the year grid is up. */}
      <div className="cal-foot">
        <ul className="cal-legend">
          <li className="cal-legend-item">
            <span className="cal-legend-dot is-overdue" aria-hidden />
            Overdue
          </li>
          <li className="cal-legend-item">
            <span className="cal-legend-dot is-due-soon" aria-hidden />
            Due within 7 days
          </li>
          <li className="cal-legend-item">
            <span className="cal-legend-dot" aria-hidden />
            Upcoming
          </li>
        </ul>

        <div className="cal-filter" role="group" aria-label="Filter by act">
          <p className="cal-filter-cap">
            {view === 'year' ? 'Acts · year' : 'Acts · month'}
          </p>
          {ACT_ORDER.map((act) => {
            const muted = mutedActs.has(act);
            return (
              <button
                key={act}
                type="button"
                onClick={() => setMutedActs((prev) => toggleMutedAct(prev, act))}
                title={ACT_META[act].full}
                aria-pressed={!muted}
                className={cn('cal-chip', muted && 'is-muted')}
              >
                {ACT_META[act].label}
                <span className="cal-chip-n">{actCounts[act]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {mode === 'maximized' ? (
        <StatutoryMaxiCalendar
          acts={ACT_ORDER}
          actCounts={actCounts}
          mutedActs={mutedActs}
          onToggleAct={(act) => setMutedActs((prev) => toggleMutedAct(prev, act))}
          onSetMutedActs={setMutedActs}
          scope={scope}
          scopes={SCOPES}
          onScopeChange={(next) => {
            setScope(next);
            setSelectedDay(null);
          }}
          viewMonth={viewMonth}
          monthLabel={monthLabel}
          canPrev={canPrev}
          canNext={canNext}
          onShiftMonth={shiftMonth}
          onJumpToday={jumpToToday}
          byDate={byDate}
          todayIso={todayIso}
          onMinimize={() => applyMode('minimized')}
        />
      ) : null}
    </div>
  );
}
