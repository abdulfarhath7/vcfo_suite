"use client";

import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, ChevronLeft, ChevronRight, Minimize2 } from 'lucide-react';
import {
  ACT_META,
  ACT_SWATCH,
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
} from '@/components/admin/statutory-calendar-utils';
import { cn } from '@/lib/utils';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
/** A date carries at most 3 deadlines — 3 fixed slots lock every cell height. */
const PILL_SLOTS = [0, 1, 2] as const;

type Scope = 'all' | 'overdue';

/**
 * Maximized statutory calendar — a full-viewport overlay so the shell header
 * and page chrome disappear without touching the app shell. All filter state
 * is owned by the minimized view and shared through props; this component is
 * presentation plus the same toggle callbacks.
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
  const cells = useMemo(() => {
    // Trim to the weeks this month actually needs so rows get maximum height.
    const six = buildStatutoryMonthGrid(viewMonth);
    const lastInMonth = six.map((c) => c.inMonth).lastIndexOf(true);
    const weeks = Math.ceil((lastInMonth + 1) / 7);
    return six.slice(0, weeks * 7);
  }, [viewMonth]);
  const weekCount = cells.length / 7;

  /** Overlay slides right to reveal the app sidebar when the pointer hits the left edge. */
  const [navPeek, setNavPeek] = useState(false);

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

  return (
    <div
      className={cn('stat-max', navPeek && 'is-nav-peek')}
      role="dialog"
      aria-modal="true"
      aria-label="Statutory calendar, maximized"
    >
      {!navPeek ? (
        <div
          className="stat-max-nav-hotzone"
          aria-hidden
          onMouseEnter={() => setNavPeek(true)}
        />
      ) : null}
      <div className="stat-max-main">
        <div className="stat-max-bar">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onShiftMonth(-1)}
              disabled={!canPrev}
              className="stat-cal-chevron"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => onShiftMonth(1)}
              disabled={!canNext}
              className="stat-cal-chevron"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <h2 className="ml-1 text-[15px] font-bold tracking-tight text-ink">{monthLabel}</h2>
            <button type="button" onClick={onJumpToday} className="stat-max-today">
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMinimize}
              className="stat-cal-chevron"
              aria-label="Minimize calendar"
              title="Minimize (Esc)"
            >
              <Minimize2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="stat-max-dows" aria-hidden>
          {WEEKDAYS.map((day) => (
            <div key={day} className="stat-max-dow">
              {day}
            </div>
          ))}
        </div>

        <div
          className="stat-max-grid"
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
                className={cn('stat-max-cell', !cell.inMonth && 'is-outside')}
                data-today={isToday ? 'true' : undefined}
              >
                <span className={cn('stat-max-num', isToday && 'is-today')}>{cell.day}</span>
                <div className="stat-max-pills">
                  {PILL_SLOTS.map((slot) => {
                    const item = items[slot];
                    if (!item) return <span key={slot} className="stat-max-pill is-empty" />;
                    return (
                      <span
                        key={slot}
                        title={item.title}
                        className={cn('stat-max-pill', ACT_SWATCH[item.act].chip)}
                      >
                        <span className={cn('stat-max-pill-notch', ACT_SWATCH[item.act].solid)} aria-hidden />
                        <span className="stat-max-pill-label">{statutoryPillLabel(item.title)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="stat-max-rail" aria-label="Calendar filters">
        <SegmentedPicker
          value={scope}
          options={scopes.map((s) => ({ value: s.id, label: s.label }))}
          onChange={onScopeChange}
          ariaLabel="Filter deadlines"
          size="sm"
          className="w-full"
        />

        <div className="stat-max-rail-rule" aria-hidden />

        <div className="stat-max-rail-group" role="group" aria-label="Categories">
          <button
            type="button"
            aria-pressed={selectAllOn}
            onClick={() =>
              onSetMutedActs(selectAllOn ? muteAllActs(acts) : selectAllActs())
            }
            className={cn('stat-max-rail-btn', selectAllOn && 'is-on')}
          >
            <CheckCheck className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
            Select all
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
                className={cn('stat-max-rail-btn', muted && 'is-muted')}
              >
                <span
                  className={cn(
                    'stat-max-rail-dot',
                    muted ? 'bg-text-tertiary/40' : ACT_SWATCH[act].solid,
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-left">{ACT_META[act].label}</span>
                <span className="stat-max-rail-n">{actCounts[act]}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
