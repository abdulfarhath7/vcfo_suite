'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Lock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkField } from '@/components/work/WorkField';
import { EmptyState } from '@/components/ui/empty-state';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { toastUndo } from '@/components/ui/undo-toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTimeBlockActions, useTimeBlocks } from '@/components/work/use-work';
import {
  PLAN_DAY_END,
  PLAN_DAY_START,
  addDaysYmd,
  dayLoadHours,
  dayMonth,
  hourLabel,
  istIso,
  istTimeOf,
  istYmdOf,
  isValidBlockRange,
  mondayOf,
  placeBlock,
  timeRangeLabel,
  weekdayShort,
  type PlannerBlock,
} from '@/lib/work/planner';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/** An open work item the planner can place on the calendar. */
export interface PlannerItem {
  key: string;
  title: string;
  companyName: string;
  dueYmd?: string;
  overdue: boolean;
  /** For the all-day row: a filing gets a red edge, a manager-dated item a lock. */
  source?: 'step' | 'filing' | 'request' | 'task';
  /** The manager set this item's dates (a window). */
  managerDated?: boolean;
}

const PX = 44;
const HOURS = PLAN_DAY_END - PLAN_DAY_START;
const SNAP_MIN = 15;
const SELECT_CLASS =
  'box-border h-10 w-full rounded-md border-1.5 border-line-strong bg-surface-raised px-3 text-[14px] text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25';

type Draft = { id?: string; itemKey: string; title: string; date: string; start: string; end: string };
type Mode = 'day' | 'week' | 'month';

const pad = (n: number) => String(n).padStart(2, '0');
/** Hours from midnight (fractional) as "HH:MM", snapped to 15 minutes. */
function hhmm(hours: number): string {
  const mins = Math.round((hours * 60) / SNAP_MIN) * SNAP_MIN;
  const clamped = Math.max(0, Math.min(24 * 60 - 1, mins));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}
const hoursOf = (iso: string) => {
  const [h, m] = istTimeOf(iso).split(':').map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
};

/** The 5 or 6 Monday-first weeks that cover the month of `ymd`. */
function monthGrid(ymd: string): string[] {
  const month = ymd.slice(0, 7);
  const out: string[] = [];
  let d = mondayOf(`${month}-01`);
  while (out.length < 42 && (out.length % 7 !== 0 || out.length === 0 || d.slice(0, 7) <= month)) {
    out.push(d);
    d = addDaysYmd(d, 1);
  }
  return out;
}

/**
 * Planner calendar (prototype `PlanCalendar`, R-21 today line): time blocks on an hour grid,
 * 8 AM to 8 PM IST, as a Day, Week or Month view.
 *   - The all-day row holds the items due that day: a filing with a red edge, a manager-dated
 *     item with a lock and a blurple edge. A click opens the item.
 *   - Drag a block to move it (to another day too), drag its bottom edge to resize it; the
 *     arrow keys move a focused block 15 minutes (Shift + arrows change its end). Each change
 *     saves through `/api/work/time-blocks/:id` and offers Undo.
 *   - Click an empty hour to plan a block; click a block to edit it in the Time block dialog.
 *   - Month shows the due count and up to two items per day; a day opens its week.
 * With `leadKey` it is a project lead's calendar for their manager: read only.
 */
export function PlannerCalendar({
  days,
  onWeek,
  onDate,
  items,
  now,
  onOpenItem,
  action,
  leadKey,
}: {
  days: string[];
  /** -1 and 1 step a week; 0 jumps back to this week. */
  onWeek: (delta: -1 | 0 | 1) => void;
  /** Jump the shown week to the one holding this IST date (Month view and Day view use it). */
  onDate?: (ymd: string) => void;
  items: PlannerItem[];
  now: Date;
  onOpenItem: (key: string) => void;
  action?: React.ReactNode;
  /** A project lead's calendar, read only (manager or admin). */
  leadKey?: string;
}) {
  const readOnly = Boolean(leadKey);
  const [mode, setMode] = useState<Mode>('week');
  const today = istYmdOf(now);
  const [dayYmd, setDayYmd] = useState(() => (days.includes(today) ? today : days[0]!));
  const [monthYmd, setMonthYmd] = useState(() => days[0]!);
  useEffect(() => {
    if (!days.includes(dayYmd)) setDayYmd(days.includes(today) ? today : days[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follow the parent's week only.
  }, [days]);

  const shown = mode === 'day' ? [dayYmd] : days;
  const grid = mode === 'month' ? monthGrid(monthYmd) : shown;
  const range = useMemo(
    () => ({ from: istIso(grid[0]!, '00:00'), to: istIso(addDaysYmd(grid[grid.length - 1]!, 1), '00:00') }),
    [grid],
  );
  const query = useTimeBlocks(range, leadKey);
  const { create, update, remove } = useTimeBlockActions();
  const [draft, setDraft] = useState<Draft | null>(null);
  const blocks = useMemo(() => query.data ?? [], [query.data]);
  const itemsByKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const todayIdx = shown.indexOf(today);
  const nowHour = (now.getTime() / 3_600_000 + 5.5) % 24;
  const load = dayLoadHours(blocks, shown);

  // Drag and resize: the block under the pointer and where it would land.
  const [drag, setDrag] = useState<{ id: string; kind: 'move' | 'resize'; day: string; start: number; end: number } | null>(null);
  const dragStart = useRef<{ y: number; start: number; end: number } | null>(null);
  const moved = useRef(false);

  const step = (delta: -1 | 0 | 1) => {
    if (mode === 'week') return onWeek(delta);
    if (mode === 'day') {
      const next = delta === 0 ? today : addDaysYmd(dayYmd, delta);
      setDayYmd(next);
      if (days.includes(next)) return;
      if (onDate) onDate(next);
      else onWeek(delta);
      return;
    }
    const base = delta === 0 ? today : `${monthYmd.slice(0, 7)}-15`;
    const d = new Date(`${base}T00:00:00Z`);
    if (delta !== 0) d.setUTCMonth(d.getUTCMonth() + delta);
    setMonthYmd(d.toISOString().slice(0, 10));
  };

  const openNew = (date: string, hour: number) =>
    readOnly
      ? undefined
      : setDraft({ itemKey: '', title: '', date, start: `${pad(hour)}:00`, end: `${pad(Math.min(hour + 1, 23))}:00` });
  const openBlock = (b: PlannerBlock) => {
    if (readOnly) {
      if (b.itemKey) onOpenItem(b.itemKey);
      return;
    }
    setDraft({
      id: b.id,
      itemKey: b.itemKey ?? '',
      title: b.title,
      date: istYmdOf(b.startsAt),
      start: istTimeOf(b.startsAt),
      end: istTimeOf(b.endsAt) === '00:00' ? '23:59' : istTimeOf(b.endsAt),
    });
  };

  /** Save a moved or resized block, with Undo back to where it was. */
  const commit = (b: PlannerBlock, day: string, start: number, end: number) => {
    const startsAt = istIso(day, hhmm(start));
    const endsAt = istIso(day, hhmm(end));
    if (startsAt === b.startsAt && endsAt === b.endsAt) return;
    if (!isValidBlockRange(startsAt, endsAt)) {
      toastError("Couldn't move the block", 'A block stays inside one day and lasts 15 minutes to 10 hours.');
      return;
    }
    const before = { id: b.id, title: b.title, startsAt: b.startsAt, endsAt: b.endsAt, itemKey: b.itemKey ?? null };
    update.mutate(
      { ...before, startsAt, endsAt },
      {
        onSuccess: () =>
          toastUndo(`${b.title} · ${weekdayShort(day)} ${dayMonth(day)} · ${timeRangeLabel(startsAt, endsAt)}`, () =>
            update.mutate(before),
          ),
        onError: (err) => toastError("Couldn't move the block", errorMessage(err)),
      },
    );
  };

  const onBlockPointerDown = (e: ReactPointerEvent<HTMLElement>, b: PlannerBlock, kind: 'move' | 'resize') => {
    if (readOnly || e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const start = hoursOf(b.startsAt);
    const end = hoursOf(b.endsAt) || 24;
    dragStart.current = { y: e.clientY, start, end };
    moved.current = false;
    setDrag({ id: b.id, kind, day: istYmdOf(b.startsAt), start, end });
  };
  const onBlockPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag || !dragStart.current) return;
    const dh = (e.clientY - dragStart.current.y) / PX;
    if (Math.abs(e.clientY - dragStart.current.y) > 3) moved.current = true;
    const snap = (h: number) => Math.round(h * 4) / 4;
    if (drag.kind === 'resize') {
      const end = Math.max(dragStart.current.start + 0.25, Math.min(PLAN_DAY_END, snap(dragStart.current.end + dh)));
      setDrag({ ...drag, end });
      return;
    }
    const len = dragStart.current.end - dragStart.current.start;
    const start = Math.max(PLAN_DAY_START, Math.min(PLAN_DAY_END - len, snap(dragStart.current.start + dh)));
    const col = document.elementsFromPoint(e.clientX, e.clientY).find((el) => (el as HTMLElement).dataset?.day) as HTMLElement | undefined;
    if (col?.dataset.day) moved.current = moved.current || col.dataset.day !== drag.day;
    setDrag({ ...drag, day: col?.dataset.day ?? drag.day, start, end: start + len });
  };
  const onBlockPointerUp = (b: PlannerBlock) => {
    const d = drag;
    setDrag(null);
    dragStart.current = null;
    if (!d) return;
    if (!moved.current) {
      openBlock(b);
      return;
    }
    commit(b, d.day, d.start, d.end);
  };
  const onBlockKey = (e: React.KeyboardEvent<HTMLElement>, b: PlannerBlock) => {
    if (readOnly) return;
    const delta = e.key === 'ArrowDown' ? 0.25 : e.key === 'ArrowUp' ? -0.25 : 0;
    if (!delta) return;
    e.preventDefault();
    const start = hoursOf(b.startsAt);
    const end = hoursOf(b.endsAt) || 24;
    if (e.shiftKey) commit(b, istYmdOf(b.startsAt), start, Math.max(start + 0.25, end + delta));
    else commit(b, istYmdOf(b.startsAt), start + delta, end + delta);
  };

  const save = (d: Draft) => {
    const startsAt = istIso(d.date, d.start);
    const endsAt = istIso(d.date, d.end);
    const title = d.title.trim() || itemsByKey.get(d.itemKey)?.title || '';
    const done = () => {
      setDraft(null);
      toastSuccess(d.id ? 'Block moved' : 'Block planned', `${title} · ${dayMonth(d.date)} · ${timeRangeLabel(startsAt, endsAt)}`);
    };
    const fail = (err: unknown) => toastError("Couldn't save the block", errorMessage(err));
    if (d.id) {
      update.mutate({ id: d.id, title, startsAt, endsAt, itemKey: d.itemKey || null }, { onSuccess: done, onError: fail });
    } else {
      create.mutate([{ itemKey: d.itemKey || null, title, startsAt, endsAt }], { onSuccess: done, onError: fail });
    }
  };

  const cols = { gridTemplateColumns: `56px repeat(${shown.length}, minmax(84px, 1fr))` };
  const dueOn = (ymd: string) => items.filter((i) => i.dueYmd === ymd);
  const meta =
    mode === 'month'
      ? new Date(`${monthYmd.slice(0, 7)}-15T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : mode === 'day'
        ? `${weekdayShort(dayYmd)} ${dayMonth(dayYmd)}`
        : `${dayMonth(days[0]!)} to ${dayMonth(days[days.length - 1]!)}`;

  return (
    <section className="surface min-w-0 overflow-hidden">
      <div className="flex min-h-[52px] flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2">
        <h2 className="text-[15px] font-medium text-ink">Calendar</h2>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted tabular-nums">{meta}</span>
        <SpectrumTabs
          label="Calendar view"
          items={[
            { key: 'day', label: 'Day' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
          ]}
          value={mode}
          onChange={(k) => {
            setMode(k as Mode);
            if (k === 'month') setMonthYmd(days[0]!);
          }}
        />
        <span className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-control-sm w-control-sm" aria-label={`Previous ${mode}`} onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" strokeWidth={1.6} />
          </Button>
          <Button variant="outline" size="icon" className="h-control-sm w-control-sm" aria-label={`Next ${mode}`} onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" strokeWidth={1.6} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => step(0)}>
            Today
          </Button>
        </span>
        {!readOnly ? (
          <Button size="sm" variant="secondary" onClick={() => openNew(shown.includes(today) ? today : shown[0]!, 10)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.6} /> Block
          </Button>
        ) : null}
        {action}
      </div>

      {mode === 'month' ? (
        <MonthView
          cells={grid}
          month={monthYmd.slice(0, 7)}
          today={today}
          blocks={blocks}
          dueOn={dueOn}
          onOpenItem={onOpenItem}
          onDay={(ymd) => {
            setMode('week');
            if (onDate) onDate(ymd);
          }}
        />
      ) : (
        <div className="overflow-x-auto">
          <div className={mode === 'day' ? 'min-w-[320px]' : 'min-w-[680px]'}>
            <div className="grid border-b border-line-soft" style={cols}>
              <span />
              {shown.map((d, i) => (
                <span
                  key={d}
                  className={cn(
                    'flex flex-col items-center py-1.5 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted',
                    d === today && 'bg-surface-sunken',
                  )}
                >
                  <span>{weekdayShort(d)}</span>
                  <span
                    className={cn(
                      'mt-0.5 grid h-7 w-7 place-items-center rounded-md text-[13px] tracking-normal tabular-nums',
                      d === today ? 'bg-brand text-on-brand' : 'text-ink',
                    )}
                  >
                    {dayMonth(d).split(' ')[0]}
                  </span>
                  <span className={cn('text-[11px] normal-case tracking-normal tabular-nums', load[i]! > 6 ? 'text-warning' : 'text-ink-faint')}>
                    {load[i]! > 0 ? `${Math.round(load[i]! * 10) / 10} h` : ' '}
                  </span>
                </span>
              ))}
            </div>
            {/* All-day row: what is due that day. */}
            <div className="grid border-b-1.5 border-line" style={cols}>
              <span className="self-center pr-2 text-right text-[11px] text-ink-faint">All day</span>
              {shown.map((d) => (
                <div key={d} className={cn('flex min-h-8 flex-col gap-1 border-l border-line-soft p-1', d === today && 'bg-surface-sunken/60')}>
                  {dueOn(d)
                    .slice(0, 3)
                    .map((i) => (
                      <button
                        key={i.key}
                        type="button"
                        onClick={() => onOpenItem(i.key)}
                        title={`${i.title} · ${i.companyName}`}
                        className={cn(
                          'flex min-w-0 items-center gap-1 rounded-mark border-l-[3px] bg-surface-raised px-1.5 py-0.5 text-left text-[11.5px] text-ink-2 shadow-[inset_0_0_0_1px_oklch(var(--line-soft))] hover:bg-hover',
                          i.source === 'filing' ? 'border-danger-mid' : i.managerDated ? 'border-brand' : 'border-line-strong',
                        )}
                      >
                        {i.managerDated ? <Lock className="h-3 w-3 flex-none text-ink-faint" strokeWidth={1.6} aria-label="Dates set by the manager" /> : null}
                        <span className="truncate">{i.title}</span>
                      </button>
                    ))}
                  {dueOn(d).length > 3 ? <span className="px-1 text-[11px] text-ink-muted">{dueOn(d).length - 3} more</span> : null}
                </div>
              ))}
            </div>
            <div className="grid" style={cols}>
              <div className="relative" style={{ height: HOURS * PX }}>
                {Array.from({ length: HOURS }, (_, h) => (
                  <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-ink-faint tabular-nums" style={{ top: h * PX }}>
                    {h === 0 ? '' : hourLabel(PLAN_DAY_START + h)}
                  </span>
                ))}
              </div>
              {shown.map((d, dayIdx) => (
                <div
                  key={d}
                  data-day={d}
                  className={cn('relative border-l border-line-soft', d === today && 'bg-surface-sunken/60')}
                  style={{ height: HOURS * PX }}
                >
                  {Array.from({ length: HOURS }, (_, h) =>
                    readOnly ? (
                      <span key={h} data-day={d} className="absolute inset-x-0 border-t border-line-soft" style={{ top: h * PX, height: PX }} />
                    ) : (
                      <button
                        key={h}
                        type="button"
                        data-day={d}
                        aria-label={`Plan ${weekdayShort(d)} ${dayMonth(d)} ${hourLabel(PLAN_DAY_START + h)}`}
                        onClick={() => openNew(d, PLAN_DAY_START + h)}
                        className="absolute inset-x-0 border-t border-line-soft hover:bg-brand-soft/40 focus-visible:bg-brand-soft/60 focus-visible:outline-none"
                        style={{ top: h * PX, height: PX }}
                      />
                    ),
                  )}
                  {dayIdx === todayIdx && nowHour >= PLAN_DAY_START && nowHour <= PLAN_DAY_END ? (
                    <i aria-hidden className="pointer-events-none absolute inset-x-0 z-[2] h-0.5 bg-highlight-bright" style={{ top: (nowHour - PLAN_DAY_START) * PX }}>
                      <b className="absolute -left-1 -top-[3px] block h-2 w-2 rounded-[1px] bg-highlight-bright" />
                    </i>
                  ) : null}
                  {blocks.map((b) => {
                    const live = drag?.id === b.id ? drag : null;
                    const at = live
                      ? live.day === d
                        ? { top: live.start - PLAN_DAY_START, height: live.end - live.start }
                        : null
                      : (() => {
                          const p = placeBlock(b, shown);
                          return p && p.dayIdx === dayIdx ? p : null;
                        })();
                    if (!at) return null;
                    const item = b.itemKey ? itemsByKey.get(b.itemKey) : undefined;
                    const late = Boolean(item?.dueYmd && istYmdOf(b.startsAt) > item.dueYmd);
                    return (
                      <div
                        key={b.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${b.title} · ${timeRangeLabel(b.startsAt, b.endsAt)}`}
                        onPointerDown={(e) => onBlockPointerDown(e, b, 'move')}
                        onPointerMove={onBlockPointerMove}
                        onPointerUp={() => onBlockPointerUp(b)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') openBlock(b);
                          else onBlockKey(e, b);
                        }}
                        title={`${b.title} · ${timeRangeLabel(b.startsAt, b.endsAt)}${late ? ' · after the due date' : ''}`}
                        className={cn(
                          'absolute inset-x-1 z-[1] touch-none select-none overflow-hidden rounded-mark px-1.5 py-1 text-left text-[11.5px] leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                          readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
                          b.itemKey ? 'border-l-[3px] border-brand bg-brand-soft text-brand-text' : 'bg-surface-sunken text-ink-2',
                          late && 'border-danger',
                          live && 'z-[3] shadow-float',
                        )}
                        style={{ top: at.top * PX + 1, height: Math.max(at.height * PX - 2, 18) }}
                      >
                        <span className="block truncate font-medium">{b.title}</span>
                        {at.height >= 0.75 ? (
                          <span className="block truncate tabular-nums opacity-80">
                            {live ? `${hhmm(live.start)} to ${hhmm(live.end)}` : timeRangeLabel(b.startsAt, b.endsAt)}
                          </span>
                        ) : null}
                        {!readOnly ? (
                          <span
                            aria-hidden
                            onPointerDown={(e) => onBlockPointerDown(e, b, 'resize')}
                            className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {mode !== 'month' && !query.isLoading && blocks.filter((b) => shown.includes(istYmdOf(b.startsAt))).length === 0 ? (
        <div className="border-t border-line-soft p-4">
          <EmptyState title={mode === 'day' ? 'No blocks this day' : 'No blocks this week'} />
        </div>
      ) : null}

      {!readOnly ? (
        <BlockDialog
          draft={draft}
          items={items}
          busy={create.isPending || update.isPending || remove.isPending}
          onClose={() => setDraft(null)}
          onSave={save}
          onOpenItem={(key) => {
            setDraft(null);
            onOpenItem(key);
          }}
          onDelete={(id) =>
            remove.mutate(id, {
              onSuccess: () => {
                setDraft(null);
                toastSuccess('Block removed');
              },
              onError: (err) => toastError("Couldn't remove the block", errorMessage(err)),
            })
          }
        />
      ) : null}
    </section>
  );
}

/** Month view: a Monday-first grid; each day shows its blocks' hours, the due count and two items. */
function MonthView({
  cells,
  month,
  today,
  blocks,
  dueOn,
  onOpenItem,
  onDay,
}: {
  cells: string[];
  month: string;
  today: string;
  blocks: PlannerBlock[];
  dueOn: (ymd: string) => PlannerItem[];
  onOpenItem: (key: string) => void;
  onDay: (ymd: string) => void;
}) {
  const hours = dayLoadHours(blocks, cells);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[680px] grid-cols-7">
        {cells.slice(0, 7).map((d) => (
          <span key={d} className="border-b border-line-soft py-1.5 text-center text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
            {weekdayShort(d)}
          </span>
        ))}
        {cells.map((d, i) => {
          const due = dueOn(d);
          const out = d.slice(0, 7) !== month;
          return (
            <div key={d} className={cn('min-h-[92px] border-b border-line-soft p-1.5', i % 7 !== 0 && 'border-l', out && 'bg-surface-sunken/50')}>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onDay(d)}
                  aria-label={`Open the week of ${dayMonth(d)}`}
                  className={cn(
                    'grid h-6 w-6 place-items-center rounded-md text-[12px] tabular-nums hover:bg-hover',
                    d === today ? 'bg-brand text-on-brand hover:bg-brand' : out ? 'text-ink-faint' : 'text-ink',
                  )}
                >
                  {Number(d.slice(8, 10))}
                </button>
                {due.length > 0 ? <span className="text-[11px] font-medium text-ink-muted tabular-nums">{due.length} due</span> : null}
                {hours[i]! > 0 ? <span className="ml-auto text-[11px] text-ink-faint tabular-nums">{Math.round(hours[i]! * 10) / 10} h</span> : null}
              </div>
              <div className="mt-1 grid gap-0.5">
                {due.slice(0, 2).map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => onOpenItem(it.key)}
                    title={`${it.title} · ${it.companyName}`}
                    className={cn('truncate text-left text-[11.5px] hover:underline', it.overdue ? 'text-danger' : 'text-ink-2')}
                  >
                    {it.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlockDialog({
  draft,
  items,
  busy,
  onClose,
  onSave,
  onDelete,
  onOpenItem,
}: {
  draft: Draft | null;
  items: PlannerItem[];
  busy: boolean;
  onClose: () => void;
  onSave: (d: Draft) => void;
  onDelete: (id: string) => void;
  onOpenItem: (key: string) => void;
}) {
  const [form, setForm] = useState<Draft | null>(draft);
  const [seen, setSeen] = useState<Draft | null>(draft);
  if (draft !== seen) {
    setSeen(draft);
    setForm(draft);
  }
  const f = form;
  const title = f ? f.title.trim() || items.find((i) => i.key === f.itemKey)?.title || '' : '';
  const valid = Boolean(f && title && f.date && isValidBlockRange(istIso(f.date, f.start), istIso(f.date, f.end)));
  const set = (patch: Partial<Draft>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  const linked = f?.itemKey ? items.find((i) => i.key === f.itemKey) : undefined;

  return (
    <Dialog open={!!draft} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-medium">{draft?.id ? 'Time block' : 'Plan a block'}</DialogTitle>
        </DialogHeader>
        {f ? (
          <div className="grid gap-3">
            <label className="grid gap-1 text-[12.5px] text-ink-muted">
              Work item
              <select
                className={SELECT_CLASS}
                value={f.itemKey}
                onChange={(e) => {
                  const next = items.find((i) => i.key === e.target.value);
                  set({ itemKey: e.target.value, title: next ? next.title : f.title });
                }}
              >
                <option value="">No item</option>
                {f.itemKey && !linked ? <option value={f.itemKey}>{f.title || 'Linked item'}</option> : null}
                {items.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.title} · {i.companyName}
                  </option>
                ))}
              </select>
            </label>
            <WorkField label="Title">
              {(id) => (
                <Input id={id} value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} placeholder={linked?.title ?? 'Focus'} />
              )}
            </WorkField>
            <div className="grid grid-cols-3 gap-3">
              <WorkField label="Date">
                {(id) => <Input id={id} type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />}
              </WorkField>
              <WorkField label="Start">
                {(id) => <Input id={id} type="time" step={900} value={f.start} onChange={(e) => set({ start: e.target.value })} />}
              </WorkField>
              <WorkField label="End">
                {(id) => (
                  <Input
                    id={id}
                    type="time"
                    step={900}
                    value={f.end}
                    onChange={(e) => set({ end: e.target.value })}
                    aria-invalid={!valid || undefined}
                  />
                )}
              </WorkField>
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <span className="flex gap-2">
            {draft?.id ? (
              <Button variant="ghost" className="text-danger" disabled={busy} onClick={() => onDelete(draft.id!)}>
                Delete
              </Button>
            ) : null}
            {draft?.id && linked ? (
              <Button variant="secondary" onClick={() => onOpenItem(linked.key)}>
                Open task
              </Button>
            ) : null}
          </span>
          <span className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!valid || busy} onClick={() => f && onSave({ ...f, title })}>
              Save
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
