'use client';

import { StepMark } from '@/components/ui/step-track';
import { cn } from '@/lib/utils';
import { axisFraction, shortDate, type BarKind, type RecordTimeline, type RowStatus, type TimelineRow } from './timeline-model';

/**
 * GANTT TIMELINE (R-21; prototype `src/components/cards/GanttTimeline.tsx`): 46px rows, 14px bars
 * with the bar radius, the orange today line with its label, and the orange COI diamond. A row
 * name carries its ST5 mark (R-22). The current phase is solid blurple for the done part and
 * blurple hatch for the rest; late time is red; a later phase is a grey outlined plan.
 *
 * Presentational only: the rows come from `buildRecordTimeline` (`timeline-model.ts`). The grid
 * keeps a 680px minimum and scrolls sideways inside its card on phones; every second tick hides
 * below md.
 */

const BAR_CLASS: Record<BarKind, string> = {
  done: 'bg-positive-mid',
  late: 'bg-danger-mid',
  cur: 'bg-brand',
  rest: 'hatch',
  plan: 'bg-surface-sunken shadow-[inset_0_0_0_1px_oklch(var(--line))]',
};

const MARK_LABEL: Record<RowStatus, string> = { done: 'Done', current: 'Current', planned: 'Planned' };

function rowEnd(r: TimelineRow): string | null {
  const ends = [...r.bars.map((b) => b.to), ...(r.milestone ? [r.milestone] : [])].sort();
  return ends.at(-1) ?? null;
}

export function GanttTimeline({
  timeline,
  today = new Date().toISOString().slice(0, 10),
  className,
}: {
  timeline: RecordTimeline;
  /** ISO date of the today line. */
  today?: string;
  className?: string;
}) {
  const { start, end, ticks, rows, incorporating } = timeline;
  if (!start || !end) return null;
  const x = (iso: string) => `${axisFraction(iso, start, end) * 100}%`;
  const todayX = x(today);
  // Before the COI: wide names and a label after each bar, no count column (prototype `wideNames noCount`).
  const cols = incorporating
    ? 'grid-cols-[200px_minmax(0,1fr)_16px] md:grid-cols-[280px_minmax(0,1fr)_56px]'
    : 'grid-cols-[200px_minmax(0,1fr)_72px] md:grid-cols-[230px_minmax(0,1fr)_100px]';

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="min-w-[680px] md:min-w-[560px]">
        <div className={cn('grid h-[46px] items-end px-4 pb-1.5 text-[11.5px] text-ink-faint md:px-5', cols)} aria-hidden>
          <span />
          <div className="relative h-full">
            {ticks.map((t, i) => (
              <span
                key={t}
                className={cn('absolute bottom-0 -translate-x-1/2 whitespace-nowrap tabular-nums', i % 2 === 1 && 'max-md:invisible')}
                style={{ left: x(t) }}
              >
                {shortDate(t)}
              </span>
            ))}
            <span className="absolute -bottom-1.5 h-[22px] border-l-[1.5px] border-highlight-bright" style={{ left: todayX }}>
              <span className="absolute -left-6 -top-[22px] rounded-sm bg-highlight-bright px-1.5 py-px text-[10.5px] font-medium text-on-brand">
                Today
              </span>
            </span>
          </div>
          <span />
        </div>
        {rows.map((r) => {
          const last = rowEnd(r);
          return (
            <div key={r.id} className={cn('grid h-row items-center border-t border-line-soft px-4 md:px-5', cols)}>
              <div className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-ink">
                <StepMark
                  state={r.status === 'done' ? 'done' : r.status === 'current' ? 'now' : 'next'}
                  size={20}
                  label={MARK_LABEL[r.status]}
                />
                <span className="min-w-0 truncate">{r.name}</span>
              </div>
              <div className="relative h-full">
                {r.bars.map((b, i) => (
                  <span
                    key={i}
                    title={`${shortDate(b.from)} to ${shortDate(b.to)}`}
                    className={cn(
                      'absolute top-1/2 h-[14px] -translate-y-1/2 rounded-bar',
                      BAR_CLASS[b.kind],
                      // Joined segments of one phase share a straight edge.
                      i > 0 && 'rounded-l-none',
                      i < r.bars.length - 1 && 'rounded-r-none',
                    )}
                    style={{ left: x(b.from), width: `max(calc(${x(b.to)} - ${x(b.from)}), 3px)` }}
                  />
                ))}
                {r.milestone ? (
                  <span
                    role="img"
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-highlight-bright"
                    style={{ left: x(r.milestone) }}
                    aria-label={`COI ${shortDate(r.milestone)}`}
                  />
                ) : null}
                <span className="absolute inset-y-0 border-l-[1.5px] border-highlight-bright" style={{ left: todayX }} aria-hidden />
                {r.label && last ? (
                  <span
                    className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-2.5 text-[12.5px] font-medium tabular-nums text-ink-muted"
                    style={{ left: x(last) }}
                  >
                    {r.label}
                  </span>
                ) : r.label && !r.bars.length && !r.milestone ? (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap text-[12.5px] font-medium tabular-nums text-ink-muted">
                    {r.label}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap text-[12.5px] text-ink-muted">
                {!incorporating && r.count ? <b className="font-medium tabular-nums text-ink">{r.count}</b> : null}
                {r.note ? <span className={cn(r.note.bad && 'font-medium text-danger')}>{r.note.text}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
