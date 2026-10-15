"use client";

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/context/AppContext';
import { CheckCheck, ChevronLeft, ChevronRight, Minimize2 } from 'lucide-react';
import {
  ACT_META,
  FY_END,
  FY_START,
  type StatutoryAct,
  type StatutoryDeadline,
} from '@/data/statutory-calendar-fy2627';
import {
  buildStatutoryMonthGrid,
  isSelectAllActive,
  isoInStatutoryFy,
  muteAllActs,
  selectAllActs,
  statutoryPillLabel,
  statutoryStatus,
  trimStatutoryMonthGrid,
} from '@/components/admin/statutory-calendar-utils';
import { cn } from '@/lib/utils';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
/** A date carries at most 3 deadlines — 3 fixed slots lock every cell height. */
const ITEM_SLOTS = [0, 1, 2] as const;

type Scope = 'all' | 'overdue';

/**
 * Maximized compliance calendar — a full-viewport overlay so the shell header
 * and page chrome disappear without touching the app shell. All filter state
 * is owned by the minimized view and shared through props; this component is
 * presentation plus the same toggle callbacks.
 *
 * Colour follows the page contract: an item's urgency rides a 2px left rule
 * and a faint wash, never a saturated fill. At this density — up to 3 named
 * deadlines in every one of 35 cells — filled chips would tile the screen.
 */
export function StatutoryMaxiCalendar({
  acts,
  actCounts,
  mutedActs,
  onToggleAct,
  onSetMutedActs,
  scope,
  scopes,
  onScopeChange,
  viewMonth,
  monthLabel,
  canPrev,
  canNext,
  onShiftMonth,
  onJumpToday,
  byDate,
  todayIso,
  onMinimize,
}: {
  acts: readonly StatutoryAct[];
  actCounts: Record<StatutoryAct, number>;
  mutedActs: ReadonlySet<StatutoryAct>;
  onToggleAct: (act: StatutoryAct) => void;
  onSetMutedActs: (next: Set<StatutoryAct>) => void;
  scope: Scope;
  scopes: readonly { id: Scope; label: string }[];
  onScopeChange: (scope: Scope) => void;
  viewMonth: Date;
  monthLabel: string;
  canPrev: boolean;
  canNext: boolean;
  onShiftMonth: (delta: number) => void;
  onJumpToday: () => void;
  byDate: ReadonlyMap<string, readonly StatutoryDeadline[]>;
  todayIso: string;
  onMinimize: () => void;
}) {
  const selectAllOn = isSelectAllActive(mutedActs);
  // Trim to the weeks this month actually needs so rows get maximum height.
  const cells = useMemo(
    () => trimStatutoryMonthGrid(buildStatutoryMonthGrid(viewMonth)),
    [viewMonth],
  );
  const weekCount = cells.length / 7;

  /** Overlay slides right to reveal the app sidebar when the pointer hits the left edge. */
  const [navPeek, setNavPeek] = useState(false);
  const { user } = useApp();
  // Slide exactly the expanded sidebar's width (RoleSidebar: client 15.5rem, staff 14rem).
  const peekLeft = user?.role === 'client' ? '15.5rem' : '14rem';

  useEffect(() => {
    if (!navPeek) return;
    // Close the peek once the pointer is back over the calendar.
    const onMove = (e: globalThis.MouseEvent) => {
      if (e.clientX > 280) setNavPeek(false);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [navPeek]);

  // Escape restores; the page behind must not scroll while the overlay is up.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onMinimize();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onMinimize]);

  // Portal to <body>: the page wrapper animates with a transform, which would
  // scope this `position: fixed` overlay to the content column and leave the
  // sidebar rail showing beside it. On the body it covers the whole viewport;
  // the left-edge hotzone slides it aside to reveal (and hover-expand) the nav.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className={cn('cal-max', navPeek && 'is-nav-peek')}
      style={navPeek ? { left: peekLeft } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Compliance calendar, maximized"
    >
      {!navPeek ? (
        <div className="cal-max-hotzone" aria-hidden onMouseEnter={() => setNavPeek(true)} />
      ) : null}
      <div className="cal-max-main">
        <div className="cal-max-bar">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onShiftMonth(-1)}
              disabled={!canPrev}
              className="cal-navbtn"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => onShiftMonth(1)}
              disabled={!canNext}
              className="cal-navbtn"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <h2 className="ml-1 mr-2 text-[15px] font-semibold tracking-tight text-foreground">
              {monthLabel}
            </h2>
            <button type="button" onClick={onJumpToday} className="cal-ghost">
              Today
            </button>
          </div>

          <button
            type="button"
            onClick={onMinimize}
            className="cal-navbtn"
            aria-label="Minimize calendar"
            title="Minimize (Esc)"
          >
            <Minimize2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="cal-max-dows" aria-hidden>
          {WEEKDAYS.map((day) => (
            <div key={day} className="cal-max-dow">
              {day}
            </div>
          ))}
        </div>

        <div
          className="cal-max-grid"
          role="grid"
          aria-label={monthLabel}
          style={{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }}
        >
          {cells.map((cell) => {
            const inFy = isoInStatutoryFy(cell.iso, FY_START, FY_END);
            const items = inFy && cell.inMonth ? (byDate.get(cell.iso) ?? []) : [];
            const isToday = cell.iso === todayIso;
            return (
              <div
                key={cell.iso}
                role="gridcell"
                className={cn('cal-max-cell', !cell.inMonth && 'is-outside')}
                data-today={isToday ? 'true' : undefined}
              >
                <span className={cn('cal-max-num', isToday && 'is-today')}>{cell.day}</span>
                <div className="cal-max-items">
                  {ITEM_SLOTS.map((slot) => {
                    const item = items[slot];
                    if (!item) return <span key={slot} className="cal-max-item is-empty" />;
                    const status = statutoryStatus(item.date, todayIso);
                    return (
                      <span
                        key={slot}
                        title={`${ACT_META[item.act].full} — ${item.title}`}
                        className={cn(
                          'cal-max-item',
                          status === 'due-soon' && 'is-due-soon',
                          status === 'overdue' && 'is-overdue',
                        )}
                      >
                        <span className="cal-max-item-tag mono">{ACT_META[item.act].label}</span>
                        <span className="cal-max-item-label">
                          {statutoryPillLabel(item.title)}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="cal-max-rail" aria-label="Calendar filters">
        <SegmentedPicker
          value={scope}
          options={scopes.map((s) => ({ value: s.id, label: s.label }))}
          onChange={onScopeChange}
          ariaLabel="Filter deadlines"
          size="sm"
          className="w-full"
        />

        <div className="cal-max-rail-rule" aria-hidden />

        <div className="cal-max-rail-group" role="group" aria-label="Filter by act">
          <p className="cal-max-rail-cap">Acts</p>
          <button
            type="button"
            aria-pressed={selectAllOn}
            onClick={() => onSetMutedActs(selectAllOn ? muteAllActs(acts) : selectAllActs())}
            className="cal-max-rail-btn"
          >
            <CheckCheck className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
            {selectAllOn ? 'Clear all' : 'Select all'}
          </button>
          {acts.map((act) => {
            const muted = mutedActs.has(act);
            return (
              <button
                key={act}
                type="button"
                onClick={() => onToggleAct(act)}
                title={ACT_META[act].full}
                aria-pressed={!muted}
                className={cn('cal-max-rail-btn', muted && 'is-muted')}
              >
                <span className="min-w-0 flex-1 truncate text-left">{ACT_META[act].label}</span>
                <span className="cal-max-rail-n">{actCounts[act]}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
