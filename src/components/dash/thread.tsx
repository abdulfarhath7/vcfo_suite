import { cn } from '@/lib/utils';
import { StepLink, StepMark } from '@/components/ui/step-track';
import { OwnerChip, type Owner } from '@/components/ui/spectrum-chip';

/**
 * Step thread (prototype cards/Thread, R-23): one row per step with the ST5 mark, joined by a
 * hairline. Done and current steps show their date at the right ("14 Oct 2026"); upcoming steps
 * are faded and show no date. `by` and `note` sit on a muted line under the title.
 */
export interface ThreadStep {
  id: string;
  title: string;
  state: 'done' | 'current' | 'upcoming';
  /** ISO date or timestamp; shown for done and current steps. */
  date?: string | null;
  by?: string;
  owner?: Owner;
  /** Owner chip text when the authority is not MCA: "GSTN", "EPFO". */
  ownerLabel?: string;
  note?: string;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Oct 2026" in India time; empty for a missing or bad date. */
export function threadDate(value: string | null | undefined): string {
  if (!value) return '';
  const t = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(t)) return '';
  const d = new Date(value.length === 10 ? t : t + 5.5 * 3_600_000);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function Thread({ steps, className }: { steps: ThreadStep[]; className?: string }) {
  return (
    <ol className={cn('relative', className)}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const date = s.state !== 'upcoming' ? threadDate(s.date) : '';
        return (
          <li key={s.id} className={cn('relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0', s.state === 'upcoming' && 'opacity-50')}>
            <StepLink x={10} y={10} up={i > 0 && (steps[i - 1].state === 'done' ? 'done' : 'todo')} down={!last && (s.state === 'done' ? 'done' : 'todo')} />
            <StepMark state={s.state === 'done' ? 'done' : s.state === 'current' ? 'now' : 'next'} size={20} />
            <div className="min-w-0 pt-px">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cn('text-[13.5px] text-ink', s.state === 'current' ? 'font-semibold' : 'font-medium')}>{s.title}</span>
                {s.owner ? <OwnerChip owner={s.owner} label={s.ownerLabel} className="h-5 w-auto px-2 text-[11.5px]" /> : null}
                {date ? <span className="ml-auto text-[12.5px] tabular-nums text-ink-muted">{date}</span> : null}
              </div>
              {(s.by || s.note) && s.state !== 'upcoming' ? (
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  {s.by}
                  {s.by && s.note ? <span className="mx-1.5 text-ink-faint">·</span> : null}
                  {s.note}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
