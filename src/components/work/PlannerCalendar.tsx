'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkField } from '@/components/work/WorkField';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTimeBlockActions, useTimeBlocks } from '@/components/work/use-work';
import {
  PLAN_DAY_END,
  PLAN_DAY_START,
  dayLoadHours,
  dayMonth,
  hourLabel,
  istIso,
  istTimeOf,
  istYmdOf,
  isValidBlockRange,
  placeBlock,
  timeRangeLabel,
  weekRange,
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
}

const PX = 40;
const HOURS = PLAN_DAY_END - PLAN_DAY_START;
const SELECT_CLASS =
  'box-border h-10 w-full rounded-md border-1.5 border-line-strong bg-surface-raised px-3 text-[14px] text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25';

type Draft = { id?: string; itemKey: string; title: string; date: string; start: string; end: string };

/**
 * Planner calendar (prototype `PlanCalendar` week view, R-21 today line): the caller's time
 * blocks on an hour grid, 8 AM to 8 PM IST. Click an empty hour to plan a block for an item
 * or for free time; click a block to move it (new day or times), resize it (new end), rename
 * it, open its task or delete it. Blocks come from `/api/work/time-blocks`.
 */
export function PlannerCalendar({
  days,
  onWeek,
  items,
  now,
  onOpenItem,
  action,
}: {
  days: string[];
  /** -1 and 1 step a week; 0 jumps back to this week. */
  onWeek: (delta: -1 | 0 | 1) => void;
  items: PlannerItem[];
  now: Date;
  onOpenItem: (key: string) => void;
  action?: React.ReactNode;
}) {
  const range = useMemo(() => weekRange(days), [days]);
  const query = useTimeBlocks(range);
  const { create, update, remove } = useTimeBlockActions();
  const [draft, setDraft] = useState<Draft | null>(null);
  const blocks = query.data ?? [];
  const itemsByKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const today = istYmdOf(now);
  const todayIdx = days.indexOf(today);
  const nowHour = (now.getTime() / 3_600_000 + 5.5) % 24;
  const load = dayLoadHours(blocks, days);

  const openNew = (date: string, hour: number) =>
    setDraft({
      itemKey: '',
      title: '',
      date,
      start: `${String(hour).padStart(2, '0')}:00`,
      end: `${String(Math.min(hour + 1, 23)).padStart(2, '0')}:00`,
    });
  const openBlock = (b: PlannerBlock) =>
    setDraft({
      id: b.id,
      itemKey: b.itemKey ?? '',
      title: b.title,
      date: istYmdOf(b.startsAt),
      start: istTimeOf(b.startsAt),
      end: istTimeOf(b.endsAt) === '00:00' ? '23:59' : istTimeOf(b.endsAt),
    });

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

  const grid = { gridTemplateColumns: `56px repeat(${days.length}, minmax(84px, 1fr))` };

  return (
    <section className="surface min-w-0 overflow-hidden">
      <div className="flex min-h-[52px] flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2">
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Calendar</h2>
        <span className="text-[12.5px] text-ink-muted tabular-nums">
          {dayMonth(days[0]!)} to {dayMonth(days[days.length - 1]!)}
        </span>
        <span className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-control-sm w-control-sm" aria-label="Previous week" onClick={() => onWeek(-1)}>
            <ChevronLeft className="h-4 w-4" strokeWidth={1.6} />
          </Button>
          <Button variant="outline" size="icon" className="h-control-sm w-control-sm" aria-label="Next week" onClick={() => onWeek(1)}>
            <ChevronRight className="h-4 w-4" strokeWidth={1.6} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onWeek(0)}>
            Today
          </Button>
        </span>
        <Button size="sm" variant="secondary" onClick={() => openNew(todayIdx >= 0 ? today : days[0]!, 10)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.6} /> Block
        </Button>
        {action}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid border-b-1.5 border-line" style={grid}>
            <span />
            {days.map((d, i) => (
              <span
                key={d}
                className={cn(
                  'flex flex-col items-center py-1.5 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted',
                  d === today && 'text-brand-text',
                )}
              >
                <span>
                  {weekdayShort(d)} <span className="tabular-nums tracking-normal">{dayMonth(d).split(' ')[0]}</span>
                </span>
                <span className={cn('text-[11px] normal-case tracking-normal tabular-nums', load[i]! > 6 ? 'text-warning' : 'text-ink-faint')}>
                  {load[i]! > 0 ? `${Math.round(load[i]! * 10) / 10} h` : ' '}
                </span>
              </span>
            ))}
          </div>
          <div className="grid" style={grid}>
            <div className="relative" style={{ height: HOURS * PX }}>
              {Array.from({ length: HOURS }, (_, h) => (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[11px] text-ink-faint tabular-nums"
                  style={{ top: h * PX }}
                >
                  {h === 0 ? '' : hourLabel(PLAN_DAY_START + h)}
                </span>
              ))}
            </div>
            {days.map((d, dayIdx) => (
              <div key={d} data-day={d} className="relative border-l border-line-soft" style={{ height: HOURS * PX }}>
                {Array.from({ length: HOURS }, (_, h) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`Plan ${weekdayShort(d)} ${dayMonth(d)} ${hourLabel(PLAN_DAY_START + h)}`}
                    onClick={() => openNew(d, PLAN_DAY_START + h)}
                    className="absolute inset-x-0 border-t border-line-soft hover:bg-brand-soft/40 focus-visible:bg-brand-soft/60 focus-visible:outline-none"
                    style={{ top: h * PX, height: PX }}
                  />
                ))}
                {dayIdx === todayIdx && nowHour >= PLAN_DAY_START && nowHour <= PLAN_DAY_END ? (
                  <i
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-[2] h-0.5 bg-highlight-bright"
                    style={{ top: (nowHour - PLAN_DAY_START) * PX }}
                  />
                ) : null}
                {blocks.map((b) => {
                  const at = placeBlock(b, days);
                  if (!at || at.dayIdx !== dayIdx) return null;
                  const item = b.itemKey ? itemsByKey.get(b.itemKey) : undefined;
                  const late = Boolean(item?.dueYmd && istYmdOf(b.startsAt) > item.dueYmd);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => openBlock(b)}
                      title={`${b.title} · ${timeRangeLabel(b.startsAt, b.endsAt)}${late ? ' · after the due date' : ''}`}
                      className={cn(
                        'absolute inset-x-1 z-[1] overflow-hidden rounded-mark px-1.5 py-1 text-left text-[11.5px] leading-tight hover:opacity-90',
                        b.itemKey ? 'border-l-[3px] border-brand bg-brand-soft text-brand-text' : 'bg-surface-sunken text-ink-2',
                        late && 'border-danger',
                      )}
                      style={{ top: at.top * PX + 1, height: Math.max(at.height * PX - 2, 18) }}
                    >
                      <span className="block truncate font-medium">{b.title}</span>
                      {at.height >= 0.75 ? (
                        <span className="block truncate tabular-nums opacity-80">{timeRangeLabel(b.startsAt, b.endsAt)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {!query.isLoading && blocks.length === 0 ? (
        <div className="border-t border-line-soft p-4">
          <EmptyState title="No blocks this week" />
        </div>
      ) : null}

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
    </section>
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
