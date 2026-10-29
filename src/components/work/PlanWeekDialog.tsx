'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PlannerItem } from '@/components/work/PlannerCalendar';
import { useTimeBlockActions, useTimeBlocks } from '@/components/work/use-work';
import { dayMonth, istYmdOf, suggestWeekBlocks, timeRangeLabel, weekRange, weekdayShort } from '@/lib/work/planner';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/**
 * Plan my week (prototype `PlanWeekDialog`): one suggested one-hour block for each open
 * item that has no block this week, overdue first and then by due date, in free working
 * hours (10 AM to 6 PM, Monday to Friday, never in the past, no day over six hours). The
 * lead unticks what they do not want and adds the rest to the calendar in one call.
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
  const companyOf = useMemo(() => new Map(items.map((i) => [i.key, i.companyName])), [items]);

  const suggestions = useMemo(() => {
    const planned = new Set((blocks.data ?? []).map((b) => b.itemKey).filter(Boolean));
    return suggestWeekBlocks({
      candidates: items
        .filter((i) => !planned.has(i.key))
        .map((i) => ({ itemKey: i.key, title: i.title, dueYmd: i.dueYmd, overdue: i.overdue })),
      busy: blocks.data ?? [],
      days,
      now,
    });
  }, [items, blocks.data, days, now]);
  const picked = suggestions.filter((s) => !skip.has(s.itemKey));

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

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setSkip(new Set());
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="border-b border-line-soft px-5 py-4">
          <DialogTitle className="text-[16px] font-medium">Planning my week</DialogTitle>
          <p className="text-[13px] text-ink-muted tabular-nums">
            {dayMonth(days[0]!)} to {dayMonth(days[days.length - 1]!)} · {picked.length} {picked.length === 1 ? 'block' : 'blocks'} ·{' '}
            {picked.length} h
          </p>
        </DialogHeader>
        <div className="max-h-[min(28rem,60vh)] overflow-y-auto">
          {blocks.isLoading ? null : suggestions.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nothing left to plan this week" />
            </div>
          ) : (
            <ul>
              {suggestions.map((s) => {
                const on = !skip.has(s.itemKey);
                const day = istYmdOf(s.startsAt);
                return (
                  <li key={s.itemKey} className="flex items-center gap-3 border-b border-line-soft px-5 py-2.5 text-[13.5px] last:border-b-0">
                    <Checkbox
                      checked={on}
                      aria-label={s.title}
                      onCheckedChange={() =>
                        setSkip((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.itemKey)) next.delete(s.itemKey);
                          else next.add(s.itemKey);
                          return next;
                        })
                      }
                    />
                    <span className="w-[132px] flex-none text-[12.5px] text-ink-muted tabular-nums">
                      {weekdayShort(day)} {dayMonth(day)} · {timeRangeLabel(s.startsAt, s.endsAt).split(' to ')[0]}
                    </span>
                    <span className={cn('min-w-0 flex-1', !on && 'text-ink-muted line-through')}>
                      <span className="block truncate font-medium text-ink">{s.title}</span>
                      <span className="block truncate text-[12px] text-ink-muted">{companyOf.get(s.itemKey)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="gap-2 border-t border-line-soft px-5 py-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={picked.length === 0 || create.isPending} onClick={apply}>
            Add {picked.length} {picked.length === 1 ? 'block' : 'blocks'} to calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
