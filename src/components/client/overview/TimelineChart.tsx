'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  timelineWorld,
  type TimelineBarView,
  type TimelineModel,
  type TimelineTone,
} from '@/lib/client-timeline';

export const TIMELINE_TONE: Record<TimelineTone, string> = {
  done: 'bg-[oklch(40%_0.045_168)]',
  current: 'bg-[oklch(30%_0.028_255)]',
  waiting: 'bg-[oklch(46%_0.055_78)]',
  upcoming: 'border border-dashed border-[oklch(70%_0.012_255)] bg-[oklch(94%_0.006_255)] dark:bg-[oklch(28%_0.01_255)]',
};

const DAY_MS = 86_400_000;
const LABEL_WIDTH = 168;
/** Most zoomed in: px per day. */
const MAX_PPD = 48;
/** Fallback before the viewport is measured (SSR, tests). */
const DEFAULT_WIDTH = 700;

type Level = 'Days' | 'Weeks' | 'Months';

function levelFor(ppd: number): Level {
  if (ppd >= 22) return 'Days';
  if (ppd >= 8) return 'Weeks';
  return 'Months';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const BUTTON =
  'inline-flex h-7 items-center justify-center rounded-md border border-border bg-background text-[12px] font-semibold text-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

/**
 * The phase chart over a wider range of whole months. Drag (or swipe, or
 * shift + scroll) to move through time; − / + / Fit and ctrl + scroll zoom
 * around the cursor, and the ruler switches between days, weeks and months.
 */
export function TimelineChart({
  model,
  bars,
  expanded,
  onToggle,
}: {
  model: TimelineModel;
  bars: TimelineBarView[];
  expanded: string | null;
  onToggle: (barId: string) => void;
}) {
  const world = useMemo(() => timelineWorld(model), [model]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const [scroll, setScroll] = useState({ left: 0, max: 0 });
  const [panning, setPanning] = useState(false);
  const pendingScroll = useRef<number | null>(null);
  const placed = useRef(false);
  const drag = useRef<{ x: number; left: number; moved: boolean; pointerId: number } | null>(null);
  const suppressClick = useRef(false);

  const viewWidth = width || DEFAULT_WIDTH;
  const minPpd = viewWidth / world.days;
  const fitPpd = clamp(viewWidth / model.spanDays, minPpd, MAX_PPD);
  const ppd = zoom == null ? fitPpd : clamp(zoom, minPpd, MAX_PPD);
  const level = levelFor(ppd);
  const fitLeft = world.offset * ppd - 4;

  function syncScroll() {
    const el = viewportRef.current;
    if (!el) return;
    setScroll({ left: el.scrollLeft, max: Math.max(0, el.scrollWidth - el.clientWidth) });
  }

  function zoomTo(next: number, anchorPx?: number) {
    const el = viewportRef.current;
    if (!el) return;
    const target = clamp(next, minPpd, MAX_PPD);
    if (Math.abs(target - ppd) < 0.001) return;
    const anchor = anchorPx ?? el.clientWidth / 2;
    const dayAtAnchor = (el.scrollLeft + anchor) / ppd;
    pendingScroll.current = dayAtAnchor * target - anchor;
    setZoom(target);
  }

  function fit() {
    const el = viewportRef.current;
    if (!el) return;
    if (zoom == null) {
      el.scrollTo?.({ left: fitLeft, behavior: 'smooth' });
      return;
    }
    pendingScroll.current = world.offset * fitPpd - 4;
    setZoom(null);
  }

  function scrollByPx(delta: number) {
    viewportRef.current?.scrollBy?.({ left: delta, behavior: 'smooth' });
  }

  function showToday() {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo?.({ left: world.today * ppd - el.clientWidth / 2, behavior: 'smooth' });
  }

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || !width) return;
    if (!placed.current) {
      placed.current = true;
      el.scrollLeft = fitLeft;
    } else if (pendingScroll.current != null) {
      el.scrollLeft = pendingScroll.current;
      pendingScroll.current = null;
    }
    syncScroll();
  }, [ppd, width, fitLeft]);

  const live = useRef({ ppd, zoomTo });
  useEffect(() => {
    live.current = { ppd, zoomTo };
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      live.current.zoomTo(live.current.ppd * Math.exp(-event.deltaY * 0.01), event.clientX - rect.left);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const startMs = Date.parse(`${world.start}T00:00:00Z`);
  const dateOf = (day: number) => new Date(startMs + day * DAY_MS);
  const ticks = useMemo(() => {
    const out: { day: number; label: string; centred: boolean }[] = [];
    if (level === 'Days') {
      for (let day = 0; day < world.days; day += 1) {
        out.push({ day, label: String(new Date(startMs + day * DAY_MS).getUTCDate()), centred: true });
      }
    } else if (level === 'Weeks') {
      for (const day of world.weeks) {
        const date = new Date(startMs + day * DAY_MS);
        out.push({
          day,
          label: `${date.getUTCDate()} ${date.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' })}`,
          centred: false,
        });
      }
    } else if (ppd * 7 >= 30) {
      for (const day of world.weeks) {
        out.push({ day, label: String(new Date(startMs + day * DAY_MS).getUTCDate()), centred: false });
      }
    }
    return out;
  }, [level, ppd, startMs, world.days, world.weeks]);

  const canEarlier = scroll.left > 1;
  const canLater = scroll.left < scroll.max - 1;
  const step = Math.round(viewWidth * 0.7);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button type="button" className={cn(BUTTON, 'w-7')} onClick={() => scrollByPx(-step)} disabled={!canEarlier} aria-label="Earlier dates">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={cn(BUTTON, 'px-2.5')} onClick={showToday}>
          Today
        </button>
        <button type="button" className={cn(BUTTON, 'w-7')} onClick={() => scrollByPx(step)} disabled={!canLater} aria-label="Later dates">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <span className="ml-1 hidden text-[11.5px] text-muted-foreground sm:inline">
          Drag the chart to see earlier or later months
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-md bg-muted/60 p-0.5" role="group" aria-label="Zoom the timeline">
          <button type="button" className={cn(BUTTON, 'w-7')} onClick={() => zoomTo(ppd / 1.5)} disabled={ppd <= minPpd + 0.01} aria-label="Zoom out">
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="min-w-[52px] text-center text-[11.5px] font-semibold text-muted-foreground" aria-live="polite">
            {level}
          </span>
          <button type="button" className={cn(BUTTON, 'w-7')} onClick={() => zoomTo(ppd * 1.5)} disabled={ppd >= MAX_PPD - 0.01} aria-label="Zoom in">
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" className={cn(BUTTON, 'px-2.5')} onClick={fit}>
            Fit
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: `${LABEL_WIDTH}px minmax(0,1fr)` }}>
        <div>
          <div className="h-10" />
          {bars.map((bar) => (
            <button
              key={bar.id}
              type="button"
              aria-expanded={expanded === bar.id}
              onClick={() => onToggle(bar.id)}
              className={cn(
                'flex h-11 w-full items-center pr-3 text-left text-[12.5px] font-semibold leading-tight text-foreground hover:bg-muted/40',
                expanded === bar.id && 'bg-muted/60',
              )}
            >
              {bar.label}
            </button>
          ))}
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a scrollable chart: keys and drag pan it, the bars inside stay the real controls */}
        <div
          ref={viewportRef}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable regions must be keyboard-focusable to be scrolled
          tabIndex={0}
          role="group"
          aria-label="Timeline dates. Use the arrow keys to move through time."
          onScroll={syncScroll}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              scrollByPx(-7 * ppd);
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              scrollByPx(7 * ppd);
            } else if (event.key === '+' || event.key === '=') {
              zoomTo(ppd * 1.5);
            } else if (event.key === '-') {
              zoomTo(ppd / 1.5);
            }
          }}
          onPointerDown={(event) => {
            if (event.pointerType !== 'mouse' || event.button !== 0) return;
            drag.current = {
              x: event.clientX,
              left: event.currentTarget.scrollLeft,
              moved: false,
              pointerId: event.pointerId,
            };
          }}
          onPointerMove={(event) => {
            const current = drag.current;
            if (!current) return;
            const dx = event.clientX - current.x;
            if (!current.moved) {
              if (Math.abs(dx) < 4) return;
              current.moved = true;
              event.currentTarget.setPointerCapture?.(current.pointerId);
              setPanning(true);
            }
            event.currentTarget.scrollLeft = current.left - dx;
          }}
          onPointerUp={() => {
            if (drag.current?.moved) suppressClick.current = true;
            drag.current = null;
            setPanning(false);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setPanning(false);
          }}
          onClickCapture={(event) => {
            if (!suppressClick.current) return;
            suppressClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
          className={cn(
            'relative min-w-0 select-none overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-md [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            panning ? 'cursor-grabbing' : 'cursor-grab',
          )}
        >
          <div className="relative" style={{ width: world.days * ppd }}>
            <div className="relative h-10 border-b border-border">
              {world.months.map((month) => (
                <span
                  key={month.day}
                  className="absolute top-0 h-4 whitespace-nowrap border-l border-border pl-1.5 text-[11px] font-semibold leading-4 text-foreground"
                  style={{ left: month.day * ppd }}
                >
                  {month.label}
                </span>
              ))}
              {ticks.map((tick) => (
                <span
                  key={tick.day}
                  className={cn(
                    'absolute bottom-1 -translate-x-1/2 whitespace-nowrap font-mono text-[10.5px]',
                    dateOf(tick.day).getUTCDay() % 6 === 0 && level === 'Days'
                      ? 'text-muted-foreground/60'
                      : 'text-muted-foreground',
                  )}
                  style={{ left: tick.day * ppd + (tick.centred ? ppd / 2 : 0) }}
                >
                  {tick.label}
                </span>
              ))}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-10" aria-hidden>
              {world.weeks.map((day) => (
                <span key={`w${day}`} className="absolute bottom-0 top-0 w-px bg-border/60" style={{ left: day * ppd }} />
              ))}
              {world.months.map((month) => (
                <span key={`m${month.day}`} className="absolute bottom-0 top-0 w-px bg-border" style={{ left: month.day * ppd }} />
              ))}
              <span
                className="absolute bottom-0 top-0 w-0.5 bg-[oklch(58%_0.08_85)]"
                style={{ left: world.today * ppd }}
              />
            </div>

            {bars.map((bar) => {
              const left = (world.offset + bar.startDay) * ppd;
              const span = bar.milestone
                ? Math.max(10, ppd)
                : Math.max(12, (bar.endDay - bar.startDay) * ppd);
              return (
                <div key={bar.id} className={cn('relative h-11', expanded === bar.id && 'bg-muted/60')}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onToggle(bar.id)}
                    aria-label={`${bar.label} · ${bar.rangeLabel}`}
                    title={`${bar.label} · ${bar.rangeLabel}`}
                    className={cn('absolute top-[13px] h-[18px] rounded-[4px]', TIMELINE_TONE[bar.tone])}
                    style={{ left, width: span }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
