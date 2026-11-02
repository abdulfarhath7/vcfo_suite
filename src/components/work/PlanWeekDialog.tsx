'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PlannerItem } from '@/components/work/PlannerCalendar';
import { useTimeBlockActions, useTimeBlocks } from '@/components/work/use-work';
import {
  HEAVY_DAY_HOURS,
  dayLoadHours,
  dayMonth,
  hourLabel,
  isWeekend,
  placeBlock,
  suggestWeekBlocks,
  timeRangeLabel,
  weekRange,
  weekdayShort,
} from '@/lib/work/planner';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

const GRID_START = 9;
const GRID_END = 18;
const PX = 40;

/**
 * Plan my week (prototype `PlanWeekDialog`): one suggested one-hour block for each open item
 * that has no block this week, in free working hours (never in the past), shown on an hour
 * grid with the blocks already planned in grey and each day's load in its head.
 *   - Day / Week switch (Day steps through the working days).
 *   - Options: keep 9 to 11 AM for deep work, filings first, group by client, allow up to 8 h
 *     a day. A blue note names the days over six hours.
 *   - A click on a suggested block skips it (40 % opacity); Reshuffle starts the plan on a
 *     later day. "Add N blocks to calendar" saves the rest in one call.
 */
export function PlanWeekDialog({
  open,
  onOpenChange,
  days,
  items,
  now,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  days: string[];
  items: PlannerItem[];
  now: Date;
}) {
  const range = useMemo(() => weekRange(days), [days]);
  const blocks = useTimeBlocks(range);
  const { create } = useTimeBlockActions();
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'day' | 'week'>('week');
  const workDays = useMemo(() => days.filter((d) => !isWeekend(d)), [days]);
  const [dayIdx, setDayIdx] = useState(0);
  const [opts, setOpts] = useState({ keepMorning: false, filingsFirst: true, groupByClient: false, long: false });
  const [shuffle, setShuffle] = useState(0);
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);

  const suggestions = useMemo(() => {
    const planned = new Set((blocks.data ?? []).map((b) => b.itemKey).filter(Boolean));
    return suggestWeekBlocks({
      candidates: items
        .filter((i) => !planned.has(i.key))
        .map((i) => ({
          itemKey: i.key,
          title: i.title,
          dueYmd: i.dueYmd,
          overdue: i.overdue,
          filing: i.source === 'filing',
          client: i.companyName,
        })),
      busy: blocks.data ?? [],
      days,
      now,
      slotStart: GRID_START,
      slotEnd: GRID_END,
      keepMorning: opts.keepMorning,
      filingsFirst: opts.filingsFirst,
      groupByClient: opts.groupByClient,
      maxDayHours: opts.long ? 8 : HEAVY_DAY_HOURS,
      shuffle,
    });
  }, [items, blocks.data, days, now, opts, shuffle]);
  const picked = suggestions.filter((s) => !skip.has(s.itemKey));
  const shown = mode === 'day' ? [workDays[Math.min(dayIdx, workDays.length - 1)] ?? days[0]!] : workDays;
  const load = dayLoadHours([...(blocks.data ?? []), ...picked], shown);
  const heavy = shown.filter((_, i) => load[i]! > HEAVY_DAY_HOURS);
  const hours = Math.round(picked.reduce((a, s) => a + (Date.parse(s.endsAt) - Date.parse(s.startsAt)) / 3_600_000, 0) * 10) / 10;

  const toggle = (key: string) =>
    setSkip((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const apply = () =>
    create.mutate(
      picked.map((s) => ({ itemKey: s.itemKey, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt })),
      {
        onSuccess: (rows) => {
          onOpenChange(false);
          toastSuccess(`${rows.length} ${rows.length === 1 ? 'block' : 'blocks'} added to the calendar`, `Week of ${dayMonth(days[0]!)}`);
        },
        onError: (err) => toastError("Couldn't add the blocks", errorMessage(err)),
      },
    );

  const cols = { gridTemplateColumns: `52px repeat(${shown.length}, minmax(96px, 1fr))` };
  const option = (key: keyof typeof opts, label: string) => (
    <label className="flex items-center gap-2 text-[13px] text-ink-2">
      <Checkbox
        checked={opts[key]}
        onCheckedChange={() => {
          setOpts((o) => ({ ...o, [key]: !o[key] }));
          setSkip(new Set());
        }}
      />
      {label}
    </label>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setSkip(new Set());
          setShuffle(0);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent size="lg" className="gap-0 p-0">
        <DialogHeader className="border-b border-line-soft px-5 py-4">
          <DialogTitle className="text-[16px] font-medium">Planning my week</DialogTitle>
          <p className="text-[13px] text-ink-muted tabular-nums">
            {dayMonth(days[0]!)} to {dayMonth(days[days.length - 1]!)} · {picked.length} {picked.length === 1 ? 'to-do' : 'to-dos'} · {hours} h
          </p>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-5 py-3">
          <SpectrumTabs
            label="Plan view"
            items={[
              { key: 'day', label: 'Day' },
              { key: 'week', label: 'Week' },
            ]}
            value={mode}
            onChange={(k) => setMode(k as 'day' | 'week')}
          />
          {mode === 'day' ? (
            <span className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-control-sm w-control-sm" aria-label="Previous day" disabled={dayIdx === 0} onClick={() => setDayIdx((i) => Math.max(0, i - 1))}>
                <ChevronLeft className="h-4 w-4" strokeWidth={1.6} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-control-sm w-control-sm"
                aria-label="Next day"
                disabled={dayIdx >= workDays.length - 1}
                onClick={() => setDayIdx((i) => Math.min(workDays.length - 1, i + 1))}
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.6} />
              </Button>
            </span>
          ) : null}
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {option('keepMorning', 'Keep 9 to 11 AM for deep work')}
            {option('filingsFirst', 'Overdue and filings first')}
            {option('groupByClient', 'Group by client')}
            {option('long', 'Allow up to 8 h a day')}
          </span>
        </div>
        {heavy.length > 0 ? (
          <p className="mx-5 mt-3 flex items-center gap-2 rounded-md bg-info-soft px-3 py-2 text-[13px] text-info">
            <Info className="h-4 w-4 flex-none" strokeWidth={1.6} aria-hidden />
            {heavy.map((d) => `${weekdayShort(d)} ${dayMonth(d)}`).join(', ')} {heavy.length === 1 ? 'is' : 'are'} over {HEAVY_DAY_HOURS} h.
          </p>
        ) : null}
        <div className="max-h-[min(30rem,60vh)] overflow-auto">
          {blocks.isLoading ? null : suggestions.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nothing left to plan this week" />
            </div>
          ) : (
            <div className={mode === 'day' ? 'min-w-[320px]' : 'min-w-[620px]'}>
              <div className="sticky top-0 z-[2] grid border-b border-line-soft bg-surface-raised" style={cols}>
                <span />
                {shown.map((d, i) => (
                  <span key={d} className="flex flex-col items-center py-1.5 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
                    {weekdayShort(d)} {dayMonth(d).split(' ')[0]}
                    <span className={cn('text-[11px] normal-case tracking-normal tabular-nums', load[i]! > HEAVY_DAY_HOURS ? 'text-warning' : 'text-ink-faint')}>
                      {Math.round(load[i]! * 10) / 10} h
                    </span>
                  </span>
                ))}
              </div>
              <div className="grid" style={cols}>
                <div className="relative" style={{ height: (GRID_END - GRID_START) * PX }}>
                  {Array.from({ length: GRID_END - GRID_START }, (_, h) => (
                    <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-ink-faint tabular-nums" style={{ top: h * PX }}>
                      {h === 0 ? '' : hourLabel(GRID_START + h)}
                    </span>
                  ))}
                </div>
                {shown.map((d) => (
                  <div key={d} className="relative border-l border-line-soft" style={{ height: (GRID_END - GRID_START) * PX }}>
                    {Array.from({ length: GRID_END - GRID_START }, (_, h) => (
                      <span key={h} className="absolute inset-x-0 border-t border-line-soft" style={{ top: h * PX, height: PX }} />
                    ))}
                    {(blocks.data ?? []).map((b) => {
                      const at = placeBlock(b, [d], GRID_START, GRID_END);
                      if (!at) return null;
                      return (
                        <span
                          key={b.id}
                          className="absolute inset-x-1 overflow-hidden rounded-mark bg-surface-sunken px-1.5 py-0.5 text-[11px] text-ink-muted"
                          style={{ top: at.top * PX + 1, height: Math.max(at.height * PX - 2, 16) }}
                          title={`${b.title} · ${timeRangeLabel(b.startsAt, b.endsAt)}`}
                        >
                          <span className="block truncate">{b.title}</span>
                        </span>
                      );
                    })}
                    {suggestions.map((s) => {
                      const at = placeBlock(s, [d], GRID_START, GRID_END);
                      if (!at) return null;
                      const on = !skip.has(s.itemKey);
                      const item = byKey.get(s.itemKey);
                      return (
                        <button
                          key={s.itemKey}
                          type="button"
                          onClick={() => toggle(s.itemKey)}
                          aria-pressed={on}
                          aria-label={`${on ? 'Skip' : 'Keep'} ${s.title}`}
                          title={`${s.title} · ${item?.companyName ?? ''} · ${timeRangeLabel(s.startsAt, s.endsAt)}`}
                          className={cn(
                            'absolute inset-x-1 z-[1] overflow-hidden rounded-mark border-1.5 px-1.5 py-0.5 text-left text-[11.5px] leading-tight',
                            item?.source === 'filing' ? 'border-danger-mid bg-danger-soft text-danger' : 'border-brand bg-brand-soft text-brand-text',
                            !on && 'opacity-40',
                          )}
                          style={{ top: at.top * PX + 1, height: Math.max(at.height * PX - 2, 18) }}
                        >
                          <span className="block truncate font-medium">{s.title}</span>
                          <span className="block truncate opacity-80">{item?.companyName}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 border-t border-line-soft px-5 py-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            disabled={suggestions.length === 0}
            onClick={() => {
              setShuffle((n) => n + 1);
              setSkip(new Set());
            }}
          >
            <Shuffle className="h-4 w-4" strokeWidth={1.6} /> Reshuffle
          </Button>
          <Button disabled={picked.length === 0 || create.isPending} onClick={apply}>
            Add {picked.length} {picked.length === 1 ? 'block' : 'blocks'} to calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

