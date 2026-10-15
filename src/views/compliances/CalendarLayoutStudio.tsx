'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { WhatsThisButton } from '@/components/ask/WhatsThisButton';
import { CompanyPicker } from '@/components/admin/CompanyPicker';
import {
  buildStatutoryMonthGrid,
  isoFromDate,
  statutoryDaysUntil,
  statutoryMonthPrefix,
  statutoryStatus,
  statutoryStatusLabel,
} from '@/components/admin/statutory-calendar-utils';
import {
  preIncorporationCopy,
  PreIncorporationPortfolioNote,
} from '@/components/compliances/PreIncorporationNotice';
import { useApp } from '@/context/AppContext';
import {
  ACT_META,
  ACT_ORDER,
  STATUTORY_DEADLINES,
  deadlineAppliesTo,
  type StatutoryAct,
  type StatutoryDeadline,
} from '@/data/statutory-calendar-fy2627';
import { isFirmWideAdmin } from '@/lib/auth';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import {
  FILING_STATUS_LABEL,
  filingStatus,
  formatFilingDate,
  monthKeyOf,
  monthLabelOf,
  type FilingRow,
} from '@/lib/filings';
import { cn } from '@/lib/utils';
import { ALL_COMPANIES, type ComplianceScope } from '@/views/compliances/compliance-scope';

type DayPopup = {
  iso: string;
  items: StatutoryDeadline[];
  top: number;
  left: number;
};

type NotePopup = {
  item: StatutoryDeadline;
  top: number;
  left: number;
};

const ACT_PILL: Record<StatutoryAct, string> = {
  GST: 'bg-[oklch(0.94_0.04_200)] text-[oklch(0.34_0.08_200)]',
  IT: 'bg-[oklch(0.94_0.04_255)] text-[oklch(0.30_0.12_255)]',
  MCA: 'bg-[oklch(0.94_0.05_295)] text-[oklch(0.32_0.14_295)]',
  FEMA: 'bg-[oklch(0.95_0.04_27)] text-[oklch(0.38_0.16_27)]',
  'STPI/SEZ': 'bg-[oklch(0.95_0.06_45)] text-[oklch(0.40_0.13_45)]',
  LABOUR: 'bg-[oklch(0.94_0.06_145)] text-[oklch(0.32_0.12_145)]',
  RERA: 'bg-[oklch(0.95_0.05_355)] text-[oklch(0.40_0.16_355)]',
  TP: 'bg-[oklch(0.95_0.08_128)] text-[oklch(0.36_0.12_128)]',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** One named colour per act, spaced so a 12px dot can be told apart.
 *  ACTS stays black (dark mode stays the existing red) and is not in this map.
 *  A day with more than one act is a black dot until it is opened. */
const ACT_DOT: Record<StatutoryAct, string> = {
  GST: 'bg-[oklch(0.72_0.13_200)]',
  IT: 'bg-[oklch(0.48_0.19_255)]',
  MCA: 'bg-[oklch(0.45_0.18_295)]',
  FEMA: 'bg-[oklch(0.54_0.22_27)]',
  'STPI/SEZ': 'bg-[oklch(0.62_0.20_45)]',
  LABOUR: 'bg-[oklch(0.50_0.16_145)]',
  RERA: 'bg-[oklch(0.60_0.23_355)]',
  TP: 'bg-[oklch(0.68_0.18_128)]',
};

function placeCenter(width: number, height: number): { top: number; left: number } {
  const margin = 16;
  return {
    left: Math.max(margin, Math.round((window.innerWidth - width) / 2)),
    top: Math.max(margin, Math.round((window.innerHeight - Math.min(height, window.innerHeight - margin * 2)) / 2)),
  };
}

function dotSize(count: number): string {
  if (count <= 1) return 'h-2.5 w-2.5';
  return 'h-3 w-3';
}

export function CalendarLayoutStudio({
  basePath,
  scope,
  month,
  onMonthChange,
  companyId,
  onCompanyChange,
  filings,
  filingsPending,
  companyQuery,
  showCompany,
  now,
}: {
  basePath: string;
  scope: ComplianceScope;
  month: Date;
  onMonthChange: (month: Date) => void;
  companyId: string;
  onCompanyChange: (id: string) => void;
  filings: FilingRow[];
  filingsPending: boolean;
  companyQuery: string;
  showCompany: boolean;
  now: Date;
}) {
  const { user, getStateForEngagement } = useApp();
  const [board, setBoard] = useState<'year' | 'month'>('year');
  const [year, setYear] = useState(() => month.getFullYear());
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [act, setAct] = useState<StatutoryAct | 'all'>('all');
  const [popup, setPopup] = useState<DayPopup | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [note, setNote] = useState<NotePopup | null>(null);
  const [noteShown, setNoteShown] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const noteTimer = useRef<number | null>(null);

  const todayIso = isoFromDate(now);
  const monthPrefix = statutoryMonthPrefix(month);
  const firmWide = isFirmWideAdmin(user?.role);
  const company =
    companyId === ALL_COMPANIES ? null : scope.engagements.find((item) => item.id === companyId) ?? null;
  const calendarMonths = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(year, index, 1)),
    [year],
  );

  const applicable = useMemo(() => {
    return STATUTORY_DEADLINES.filter((item) => {
      if (company && !deadlineAppliesTo(item, company)) return false;
      if (!firmWide && !company && !scope.engagements.some((engagement) => deadlineAppliesTo(item, engagement))) {
        return false;
      }
      return true;
    });
  }, [company, firmWide, scope.engagements]);

  const monthItems = useMemo(
    () => applicable.filter((item) => item.date.startsWith(monthPrefix)),
    [applicable, monthPrefix],
  );

  const visible = useMemo(() => {
    return monthItems.filter((item) => {
      if (act !== 'all' && item.act !== act) return false;
      if (overdueOnly && statutoryStatus(item.date, todayIso) !== 'overdue') return false;
      return true;
    });
  }, [monthItems, act, overdueOnly, todayIso]);

  const byDate = useMemo(() => {
    const map = new Map<string, StatutoryDeadline[]>();
    for (const item of visible) {
      const list = map.get(item.date);
      if (list) list.push(item);
      else map.set(item.date, [item]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const preCount = scope.engagements.filter(
    (engagement) => !isIncorporated(engagement, getStateForEngagement(engagement)),
  ).length;
  const companyPre = Boolean(company && !isIncorporated(company, getStateForEngagement(company)));

  const chooseAct = (next: StatutoryAct) => {
    setAct((current) => (current === next ? 'all' : next));
  };

  const clearCloseTimer = () => {
    if (closeTimer.current === null) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const dismissPopup = useCallback(() => {
    setPopupOpen(false);
    setNoteShown(false);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setPopup(null);
      setNote(null);
      closeTimer.current = null;
    }, 320);
  }, []);

  const openNote = (item: StatutoryDeadline, _rect: DOMRect, _centered = false) => {
    const { top, left } = placeCenter(360, 460);
    if (noteTimer.current !== null) {
      window.clearTimeout(noteTimer.current);
      noteTimer.current = null;
    }
    setNote({ item, top, left });
    if (noteShown) return;
    setNoteShown(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setNoteShown(true));
    });
  };

  const dismissNote = useCallback(() => {
    setNoteShown(false);
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => {
      setNote(null);
      noteTimer.current = null;
    }, 300);
  }, []);

  useEffect(() => () => clearCloseTimer(), []);

  const shiftYear = (delta: number) => {
    const nextYear = year + delta;
    setYear(nextYear);
    onMonthChange(new Date(nextYear, month.getMonth(), 1));
  };

  const openMonth = (next: Date) => {
    setYear(next.getFullYear());
    onMonthChange(next);
    clearCloseTimer();
    setPopupOpen(false);
    setPopup(null);
    setNoteShown(false);
    setNote(null);
    setBoard('month');
  };

  const openDay = (iso: string, items: StatutoryDeadline[], _rect: DOMRect) => {
    clearCloseTimer();
    setNoteShown(false);
    setNote(null);
    const estimated = Math.min(140 + items.length * 108, window.innerHeight - 32);
    const { top, left } = placeCenter(380, estimated);
    const alreadyOpen = popupOpen && popup !== null;
    setPopup({ iso, items, top, left });
    if (alreadyOpen) {
      setPopupOpen(true);
      return;
    }
    setPopupOpen(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setPopupOpen(true));
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {companyPre && company ? (
        <IncorporationCenterPop
          companyId={company.id}
          scope={{ audience: scope.audience, companyName: company.companyName }}
        />
      ) : !company && preCount > 0 ? (
        <PreIncorporationPortfolioNote count={preCount} />
      ) : null}

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous year"
                onClick={() => shiftYear(-1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors duration-200 hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="inline-flex h-11 min-w-[7.5rem] items-center justify-center rounded-xl border border-border bg-muted px-5 text-[20px] font-semibold tabular-nums tracking-tight text-foreground">
                {year}
              </p>
              <button
                type="button"
                aria-label="Next year"
                onClick={() => shiftYear(1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors duration-200 hover:bg-muted"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            {board === 'month' ? (
              <button
                type="button"
                onClick={() => setBoard('year')}
                className="text-[12.5px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                All months
              </button>
            ) : null}
            <ScopeToggle overdueOnly={overdueOnly} onChange={setOverdueOnly} />
          </div>
          {scope.engagements.length > 1 ? (
            <CompanyPicker engagements={scope.engagements} value={companyId} onChange={onCompanyChange} />
          ) : null}
        </div>
        <div className="flex justify-center">
          <ActStrip act={act} onAct={chooseAct} />
        </div>
      </div>

      {board === 'year' ? (
        <YearGrid
          months={calendarMonths}
          items={applicable}
          todayIso={todayIso}
          act={act}
          overdueOnly={overdueOnly}
          onOpen={openMonth}
          onDay={openDay}
        />
      ) : (
        <MonthBoard
          month={month}
          todayIso={todayIso}
          groups={byDate}
          monthItems={monthItems}
          visible={visible}
          act={act}
          onAct={chooseAct}
          onMonth={openMonth}
          onDay={openDay}
        />
      )}

      {popup ? (
        <DayPopupCard
          popup={popup}
          todayIso={todayIso}
          shown={popupOpen}
          onClose={dismissPopup}
          onOpenNote={openNote}
          onCloseNote={dismissNote}
          noteOpen={note !== null}
        />
      ) : null}
      {note ? (
        <ObligationNote note={note} todayIso={todayIso} shown={noteShown} onClose={dismissNote} />
      ) : null}

      <UrgentPending items={applicable} todayIso={todayIso} act={act} onOpenNote={openNote} />

      {board === 'month' ? (
        <FilingRegister
          monthLabel={monthLabelOf(monthPrefix)}
          filings={filings}
          pending={filingsPending}
          now={now}
          basePath={basePath}
          companyQuery={companyQuery}
          showCompany={showCompany}
          monthKey={monthPrefix}
          fyStartYear={month.getMonth() >= 3 ? month.getFullYear() : month.getFullYear() - 1}
        />
      ) : null}
    </div>
  );
}

const PRE_INC_NOTICE_KEY = 'vcfo.calendar.pre-inc-notice.';
/** Survives remounts in this tab before storage is read. */
const preIncNoticeSeen = new Set<string>();

function preIncNoticeAlreadySeen(companyId: string): boolean {
  if (preIncNoticeSeen.has(companyId)) return true;
  try {
    return window.localStorage.getItem(PRE_INC_NOTICE_KEY + companyId) === '1';
  } catch {
    return false;
  }
}

function rememberPreIncNotice(companyId: string) {
  preIncNoticeSeen.add(companyId);
  try {
    window.localStorage.setItem(PRE_INC_NOTICE_KEY + companyId, '1');
  } catch {
    // Private mode — the in-memory set still blocks a repeat this visit.
  }
}

function IncorporationCenterPop({
  companyId,
  scope,
}: {
  companyId: string;
  scope: { audience: 'client' | 'staff'; companyName?: string };
}) {
  const [shown, setShown] = useState(false);
  const [present, setPresent] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  const removeTimer = useRef<number | null>(null);

  const close = () => {
    setShown(false);
    if (removeTimer.current !== null) window.clearTimeout(removeTimer.current);
    removeTimer.current = window.setTimeout(() => setPresent(false), 600);
  };

  useEffect(() => {
    if (preIncNoticeAlreadySeen(companyId)) return;
    setPresent(true);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setShown(true));
    });
    // Remember after the notice has actually stayed up. A timeout that is
    // cleared on the development double-mount still lets the first real open through.
    const markTimer = window.setTimeout(() => rememberPreIncNotice(companyId), 400);
    leaveTimer.current = window.setTimeout(close, 4600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(markTimer);
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
      if (removeTimer.current !== null) window.clearTimeout(removeTimer.current);
    };
  }, [companyId]);

  if (!present) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center p-4',
        'transition-opacity duration-[600ms] ease-out motion-reduce:transition-none',
        shown ? 'opacity-100' : 'opacity-0',
      )}
    >
      <button
        type="button"
        aria-label="Dismiss notice"
        className="absolute inset-0 bg-foreground/10"
        onClick={close}
      />
      <div
        role="status"
        className={cn(
          'relative w-[min(28rem,calc(100%-2rem))] rounded-[1.35rem] border border-border bg-surface px-5 py-4',
          'transition-[opacity,transform] duration-[600ms] ease-out motion-reduce:transition-none',
          shown ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.98] opacity-0',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-semibold text-foreground">Compliance begins after incorporation</p>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-foreground">{preIncorporationCopy(scope)}</p>
      </div>
    </div>
  );
}

function ScopeToggle({
  overdueOnly,
  onChange,
}: {
  overdueOnly: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border p-0.5 text-[12px]">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          'rounded-full px-3 py-1 transition-colors duration-200',
          !overdueOnly ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        All
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          'rounded-full px-3 py-1 transition-colors duration-200',
          overdueOnly ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Overdue
      </button>
    </div>
  );
}

function ActStrip({ act, onAct }: { act: StatutoryAct | 'all'; onAct: (act: StatutoryAct) => void }) {
  return (
    <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-[16px] border border-white/80 bg-white/70 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_28px_-18px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      {ACT_ORDER.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onAct(key)}
          title={ACT_META[key].full}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-2 py-1 text-[17px] font-medium tracking-[-0.01em] transition-colors duration-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
            act !== 'all' && act !== key ? 'opacity-35' : 'text-foreground',
          )}
        >
          <span className={cn('h-3 w-3 rounded-full ring-2 ring-white/80 dark:ring-white/10', ACT_DOT[key])} />
          {ACT_META[key].label}
        </button>
      ))}
      <span className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-[17px] font-medium tracking-[-0.01em] text-foreground">
        <span className="h-3 w-3 rounded-full bg-[#1A1A1A] ring-2 ring-white/80 dark:bg-[#E03131] dark:ring-white/10" />
        ACTS
      </span>
    </div>
  );
}

function itemsForMonth(
  items: readonly StatutoryDeadline[],
  month: Date,
  todayIso: string,
  act: StatutoryAct | 'all',
  overdueOnly: boolean,
): StatutoryDeadline[] {
  const prefix = statutoryMonthPrefix(month);
  return items.filter((item) => {
    if (!item.date.startsWith(prefix)) return false;
    if (act !== 'all' && item.act !== act) return false;
    if (overdueOnly && statutoryStatus(item.date, todayIso) !== 'overdue') return false;
    return true;
  });
}

function YearGrid({
  months,
  items,
  todayIso,
  act,
  overdueOnly,
  onOpen,
  onDay,
}: {
  months: Date[];
  items: readonly StatutoryDeadline[];
  todayIso: string;
  act: StatutoryAct | 'all';
  overdueOnly: boolean;
  onOpen: (month: Date) => void;
  onDay: (iso: string, items: StatutoryDeadline[], rect: DOMRect) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {months.map((month) => {
        const rows = itemsForMonth(items, month, todayIso, act, overdueOnly);
        return (
          <MonthCard
            key={statutoryMonthPrefix(month)}
            month={month}
            rows={rows}
            onOpen={() => onOpen(month)}
            onDay={onDay}
          />
        );
      })}
    </div>
  );
}

function MonthCard({
  month,
  rows,
  onOpen,
  onDay,
}: {
  month: Date;
  rows: StatutoryDeadline[];
  onOpen: () => void;
  onDay: (iso: string, items: StatutoryDeadline[], rect: DOMRect) => void;
}) {
  const byDate = new Map<string, StatutoryDeadline[]>();
  for (const row of rows) {
    const list = byDate.get(row.date);
    if (list) list.push(row);
    else byDate.set(row.date, [row]);
  }
  const cells = buildStatutoryMonthGrid(month);
  const label = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-[1.35rem] border border-border bg-surface p-3.5">
      <button
        type="button"
        onClick={onOpen}
        className="mb-2 flex w-full items-center justify-between gap-2 text-left transition-colors duration-200 hover:text-foreground"
      >
        <span className="text-[13.5px] font-semibold tracking-tight text-foreground">{label}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {rows.length}
        </span>
      </button>
      <div className="mb-2.5 grid grid-cols-7 text-center text-[11px] font-medium tracking-[0.04em] text-foreground/70">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`} className="py-0.5">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayItems = cell.inMonth ? byDate.get(cell.iso) ?? [] : [];
          const openable = cell.inMonth && dayItems.length > 0;
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={!openable}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => onDay(cell.iso, dayItems, event.currentTarget.getBoundingClientRect())}
              className="flex h-10 flex-col items-center justify-start rounded-md pt-1 transition-colors duration-200 enabled:hover:bg-muted/70 disabled:cursor-default"
            >
              <span
                className={cn(
                  'text-[11px] font-medium tabular-nums leading-none',
                  cell.inMonth ? 'text-[#1A1A1A] dark:text-[#F3F4F6]' : 'text-muted-foreground/60',
                )}
              >
                {cell.day}
              </span>
              <DayDot items={dayItems} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthBoard({
  month,
  todayIso,
  groups,
  monthItems,
  visible,
  act,
  onAct,
  onMonth,
  onDay,
}: {
  month: Date;
  todayIso: string;
  groups: [string, StatutoryDeadline[]][];
  monthItems: StatutoryDeadline[];
  visible: StatutoryDeadline[];
  act: StatutoryAct | 'all';
  onAct: (act: StatutoryAct) => void;
  onMonth: (month: Date) => void;
  onDay: (iso: string, items: StatutoryDeadline[], rect: DOMRect) => void;
}) {
  const title = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const cells = buildStatutoryMonthGrid(month);
  const byDate = new Map(groups);
  const actCounts = ACT_ORDER.map((key) => ({
    key,
    count: monthItems.filter((item) => item.act === key).length,
  }));
  const navButton =
    'inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-black/[0.06] bg-white/70 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors duration-200 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none';

  return (
    <section className="overflow-hidden rounded-[20px] border border-white/80 bg-white/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_1px_1px_rgba(15,23,42,0.04),0_22px_48px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_22px_48px_-28px_rgba(0,0,0,0.55)]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
          <span className="rounded-full bg-black/[0.045] px-2.5 py-0.5 text-[12px] font-medium tabular-nums text-muted-foreground dark:bg-white/[0.06]">
            {visible.length} {visible.length === 1 ? 'deadline' : 'deadlines'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" aria-label="Previous month" onClick={() => onMonth(addMonth(month, -1))} className={navButton}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next month" onClick={() => onMonth(addMonth(month, 1))} className={navButton}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="mb-3 grid grid-cols-7 rounded-[12px] bg-black/[0.03] py-2 text-center text-[11px] font-semibold tracking-[0.16em] text-muted-foreground dark:bg-white/[0.04]">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayItems = cell.inMonth ? byDate.get(cell.iso) ?? [] : [];
          const openable = cell.inMonth && dayItems.length > 0;
          const today = cell.inMonth && cell.iso === todayIso;
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={!openable}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => onDay(cell.iso, dayItems, event.currentTarget.getBoundingClientRect())}
              className={cn(
                'flex h-12 flex-col items-center justify-start gap-1 rounded-[10px] pt-1.5 transition-colors duration-200 enabled:hover:bg-black/[0.04] disabled:cursor-default dark:enabled:hover:bg-white/[0.05]',
                today && 'bg-white shadow-[inset_0_0_0_1px_rgba(26,26,26,0.16)] dark:bg-white/[0.06] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]',
              )}
            >
              <span
                className={cn(
                  'text-[13px] font-medium tabular-nums leading-none',
                  cell.inMonth ? 'text-[#1A1A1A] dark:text-[#F3F4F6]' : 'text-muted-foreground/45',
                )}
              >
                {cell.day}
              </span>
              <DayDot items={dayItems} />
            </button>
          );
        })}
      </div>
      <div className="mt-4 border-t border-black/[0.06] pt-3 dark:border-white/10">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">BY ACT</p>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-black/[0.06] sm:grid-cols-4 dark:bg-white/10">
          {actCounts.map(({ key, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => onAct(key)}
              className={cn(
                'flex items-center justify-between gap-3 bg-white/85 px-3 py-2.5 text-left transition-colors duration-200 hover:bg-white dark:bg-white/[0.03] dark:hover:bg-white/[0.06]',
                act !== 'all' && act !== key && 'opacity-40',
              )}
            >
              <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', ACT_DOT[key])} />
                <span className="truncate">{ACT_META[key].label}</span>
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-foreground">{count}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function DayDot({ items }: { items: StatutoryDeadline[] }) {
  if (items.length === 0) return <span className="-mt-0.5 h-2.5 w-2.5" />;
  const acts = uniqueActs(items);
  const mixed = acts.length > 1;
  return (
    <span
      className={cn(
        '-mt-0.5 rounded-full',
        dotSize(items.length),
        mixed ? 'bg-[#1A1A1A] dark:bg-[#E03131]' : ACT_DOT[acts[0]!],
      )}
      title={acts.map((act) => ACT_META[act].label).join(', ')}
    />
  );
}

function DayPopupCard({
  popup,
  todayIso,
  shown,
  noteOpen,
  onClose,
  onOpenNote,
  onCloseNote,
}: {
  popup: DayPopup;
  todayIso: string;
  shown: boolean;
  noteOpen: boolean;
  onClose: () => void;
  onOpenNote: (item: StatutoryDeadline, rect: DOMRect, centered?: boolean) => void;
  onCloseNote: () => void;
}) {
  useEffect(() => {
    if (!shown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (noteOpen) onCloseNote();
      else onClose();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-day-popup], [data-open-note]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [noteOpen, onClose, onCloseNote, shown]);

  const heading = formatLongDate(popup.iso);
  const countLabel = popup.items.length === 1 ? '1 obligation due' : `${popup.items.length} obligations due`;

  return (
    <div
      data-day-popup
      role="dialog"
      aria-label={heading}
      className={cn(
        'fixed z-50 w-[380px] rounded-[1.35rem] border border-border bg-surface',
        'transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
      )}
      style={{ top: popup.top, left: popup.left }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <p className="text-[18px] font-semibold tracking-tight text-foreground">{heading}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{countLabel}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 flex max-h-[360px] flex-col gap-2 overflow-y-auto border-t border-foreground/10 px-3 py-3">
        {popup.items.map((item, index) => {
          const mark = referenceMark(item.id, item.date, todayIso);
          return (
            <li
              key={item.id}
              className={cn(
                'rounded-2xl border border-border p-3 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
                shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
              )}
              style={{ transitionDelay: shown ? `${60 + index * 40}ms` : '0ms' }}
            >
              <div className="flex items-start gap-2">
                <span className="w-14 shrink-0 pt-1 text-[12px] font-semibold text-foreground">
                  {ACT_META[item.act].label}
                </span>
                <span className={cn('min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug', ACT_PILL[item.act])}>
                  {item.title}
                </span>
                <button
                  type="button"
                  data-open-note
                  aria-label={`Open the note for ${item.title}`}
                  onClick={(event) => onOpenNote(item, event.currentTarget.getBoundingClientRect())}
                  className="mt-0.5 rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 pl-16">
                <TimingChip mark={mark} todayIso={todayIso} date={item.date} />
                {mark !== 'upcoming' ? (
                  <p className="mt-1.5 text-[12px] leading-snug text-foreground">
                    Due date {formatLongDate(item.date)} · {mark === 'done' ? 'Done' : dueInText(item.date, todayIso)}
                  </p>
                ) : null}
                <p className="mt-1.5 text-[13px] font-medium text-foreground">{ACT_META[item.act].label}</p>
                <p className="text-[12px] text-muted-foreground">{ACT_META[item.act].full}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ObligationNote({
  note,
  todayIso,
  shown,
  onClose,
}: {
  note: NotePopup;
  todayIso: string;
  shown: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!shown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-day-popup], [data-open-note]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose, shown]);

  const { item } = note;
  const mark = referenceMark(item.id, item.date, todayIso);
  const form = formFromTitle(item.title);
  const heading = `${ACT_META[item.act].label} — ${item.title}`;

  return (
    <div
      data-day-popup
      role="dialog"
      aria-label={heading}
      className={cn(
        'fixed z-50 w-[360px] rounded-[1.35rem] border border-border bg-surface',
        'transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
      )}
      style={{ top: note.top, left: note.left }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3">
        <h3 className="min-w-0 break-words text-[15px] font-semibold leading-snug text-foreground">{heading}</h3>
        <button
          type="button"
          aria-label="Close note"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex max-h-[min(28rem,calc(100vh-8rem))] flex-col gap-3 overflow-y-auto px-4 py-3">
        <NoteField label="Due date" value={formatLongDate(item.date)} />
        <div>
          <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">Due in</p>
          <p className="mt-1 text-[14px] text-foreground">
            {mark === 'done' ? 'Done' : dueInText(item.date, todayIso)}
          </p>
          <div className="mt-1.5">
            <TimingChip mark={mark} todayIso={todayIso} date={item.date} />
          </div>
        </div>
        <NoteField label="Deadline" value={item.title} />
        <NoteField label="Act" value={ACT_META[item.act].full} />
        {form ? <NoteField label="Form" value={form} /> : null}
      </div>
    </div>
  );
}

function UrgentPending({
  items,
  todayIso,
  act,
  onOpenNote,
}: {
  items: readonly StatutoryDeadline[];
  todayIso: string;
  act: StatutoryAct | 'all';
  onOpenNote: (item: StatutoryDeadline, rect: DOMRect, centered?: boolean) => void;
}) {
  const urgent = items
    .filter((item) => (act === 'all' || item.act === act) && isHardDeadline(item.date, todayIso))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  if (urgent.length === 0) return null;

  return (
    <section className="rounded-[1.35rem] border border-border bg-surface" aria-label="Urgent pending">
      <header className="border-b border-foreground/10 px-4 py-3">
        <h2 className="text-[15px] font-semibold text-foreground">Urgent pending</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {urgent.length} {urgent.length === 1 ? 'deadline' : 'deadlines'}
        </p>
      </header>
      <ul className="max-h-[440px] divide-y divide-foreground/10 overflow-y-auto">
        {urgent.map((item) => {
          const mark = referenceMark(item.id, item.date, todayIso);
          return (
          <li key={item.id}>
            <button
              type="button"
              data-open-note
              onClick={(event) => onOpenNote(item, event.currentTarget.getBoundingClientRect(), true)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-muted/60"
            >
              <span className="w-16 shrink-0 pt-0.5 text-[12px] font-semibold text-foreground">
                {ACT_META[item.act].label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium leading-snug text-foreground">{item.title}</span>
                <span className="mt-1 block text-[12px] text-foreground">
                  Due date {formatLongDate(item.date)} · {mark === 'done' ? 'Done' : dueInText(item.date, todayIso)}
                </span>
                <span className="mt-1.5 inline-flex">
                  <TimingChip mark={mark} todayIso={todayIso} date={item.date} />
                </span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
          );
        })}
      </ul>
    </section>
  );
}

function NoteField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-[14px] leading-snug text-foreground">{value}</p>
    </div>
  );
}

type ReferenceMark = 'hard' | 'overdue' | 'done' | 'upcoming';

function TimingChip({ mark, date, todayIso }: { mark: ReferenceMark; date: string; todayIso: string }) {
  if (mark === 'done') {
    return (
      <span className="inline-flex rounded-full border border-[oklch(0.62_0.12_145)] px-2 py-0.5 text-[11px] font-medium text-[oklch(0.40_0.12_145)]">
        Done
      </span>
    );
  }
  if (mark === 'overdue') {
    return (
      <span className="inline-flex rounded-full bg-[oklch(0.95_0.03_25)] px-2 py-0.5 text-[11px] font-medium text-[oklch(0.46_0.16_25)]">
        Overdue
      </span>
    );
  }
  if (mark === 'hard') {
    return (
      <span className="inline-flex rounded-full border border-[oklch(0.62_0.18_25)] px-2 py-0.5 text-[11px] font-medium text-[oklch(0.46_0.16_25)]">
        Hard deadline
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
      {statutoryStatusLabel(date, todayIso)}
    </span>
  );
}

/** Placeholder mix until a filing is linked: past dates read Overdue, the next 7 days read Hard deadline, and a stable slice reads Done. */
function referenceMark(id: string, dateIso: string, todayIso: string): ReferenceMark {
  const status = statutoryStatus(dateIso, todayIso);
  if (status === 'upcoming') return 'upcoming';
  const sample = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5 === 0;
  if (sample) return 'done';
  if (status === 'overdue') return 'overdue';
  return 'hard';
}

function isHardDeadline(dateIso: string, todayIso: string): boolean {
  return statutoryStatus(dateIso, todayIso) !== 'upcoming';
}

function dueInText(dateIso: string, todayIso: string): string {
  const days = statutoryDaysUntil(dateIso, todayIso);
  if (days < 0) {
    const count = Math.abs(days);
    return count === 1 ? 'Overdue by 1 day' : `Overdue by ${count} days`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due in 1 day';
  return `Due in ${days} days`;
}

function formatLongDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formFromTitle(title: string): string | null {
  const matches = title.match(/\b(?:Form\s+[A-Z0-9][\w.-]*|GSTR-\d+[A-Z]?|ITR-\d+|CMP-\d+|PMT-\d+|ITC-\d+)\b/gi);
  if (!matches || matches.length === 0) return null;
  return [...new Set(matches)].join(', ');
}

function uniqueActs(items: readonly StatutoryDeadline[]): StatutoryAct[] {
  const present = new Set(items.map((item) => item.act));
  return ACT_ORDER.filter((key) => present.has(key));
}

function addMonth(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

function FilingRegister({
  monthLabel,
  filings,
  pending,
  now,
  basePath,
  companyQuery,
  showCompany,
  monthKey,
  fyStartYear,
}: {
  monthLabel: string;
  filings: FilingRow[];
  pending: boolean;
  now: Date;
  basePath: string;
  companyQuery: string;
  showCompany: boolean;
  monthKey: string;
  fyStartYear: number;
}) {
  return (
    <section className="rounded-[1.35rem] border border-border bg-surface px-4 py-3" aria-label={`${monthLabel} register`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-medium text-foreground">{monthLabel} · your filings</h2>
        <Link
          href={`${basePath}/filings?cadence=monthly&period=${monthKey}&fy=${fyStartYear}${companyQuery}`}
          className="text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          View this month&rsquo;s filings
        </Link>
      </div>
      {pending ? (
        <div className="h-16 animate-pulse rounded-md bg-muted/40" />
      ) : filings.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing in your register falls due this month.</p>
      ) : (
        <ul>
          {filings.map((row) => {
            const status = filingStatus(row, now);
            return (
              <li key={row.id} className="flex items-baseline justify-between gap-3 border-t border-border py-2">
                <span className="min-w-0">
                  <span className="flex items-center gap-1">
                    <Link
                      href={`${basePath}/filings?cadence=monthly&period=${monthKeyOf(row.dueDate)}${companyQuery}`}
                      className="truncate text-[13px] text-foreground hover:underline"
                    >
                      {row.particular}
                    </Link>
                    <WhatsThisButton compact kind="compliance" refId={row.obligationId} label={row.particular} />
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {showCompany ? `${row.companyName} · ` : ''}
                    {row.compliance} · {formatFilingDate(row.dueDate)}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-[11px]',
                    status === 'filed' && 'text-[oklch(0.42_0.1_155)]',
                    status === 'overdue' && 'font-medium text-[oklch(0.48_0.16_25)]',
                    status !== 'filed' && status !== 'overdue' && 'text-muted-foreground',
                  )}
                >
                  {FILING_STATUS_LABEL[status]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
