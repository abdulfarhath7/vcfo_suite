'use client';

import { cn } from '@/lib/utils';

export interface RecordPhase {
  id: string;
  label: string;
  done: number;
  total: number;
  /** The step numbers the phase holds, written after the count: "Steps 1–5". */
  range?: string;
}

/**
 * ST5 phase track of a client record (R-22; prototype `PhaseTrack`). One bar per phase, sized by
 * its step count: a finished phase is green, the current one blurple with a soft ring, a later
 * one grey; a later phase that is partly done fills in faint grey. Each bar is a button that picks the phase in place (R-36). On phones only the four
 * bars show, with the picked phase written under them.
 */
export function RecordPhaseTrack({
  phases,
  picked,
  onPick,
  className,
}: {
  phases: readonly RecordPhase[];
  picked: string;
  onPick: (id: string) => void;
  className?: string;
}) {
  const cur = phases.findIndex((p) => p.done < p.total);
  const pickedPhase = phases.find((p) => p.id === picked) ?? phases[0];
  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex gap-2" role="group" aria-label="Phases">
        {phases.map((p, i) => {
          const full = p.total > 0 && p.done >= p.total;
          const isCur = i === cur;
          const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={picked === p.id}
              aria-label={`${p.label} · ${p.done} of ${p.total}`}
              onClick={() => onPick(p.id)}
              style={{ flex: `${Math.max(1, p.total)} 1 0` }}
              className={cn(
                '-m-1 flex min-w-0 flex-col gap-[7px] rounded-md p-1 text-left hover:bg-surface-sunken',
                picked === p.id && 'bg-surface-sunken',
              )}
            >
              <span className={cn('hidden truncate text-[13px] font-medium md:block', full || isCur ? 'text-ink' : 'text-ink-muted')}>
                {p.label}
              </span>
              <span
                className={cn(
                  'relative block h-2.5 overflow-hidden rounded-bar bg-surface-sunken',
                  isCur && 'ring-[1.5px] ring-brand-line',
                )}
              >
                {full || pct > 0 ? (
                  <i
                    className={cn('absolute inset-y-0 left-0 rounded-bar', full ? 'bg-positive-mid' : isCur ? 'bg-brand' : 'bg-ink-faint')}
                    style={{ width: full ? '100%' : `max(${pct}%, 6px)` }}
                  />
                ) : null}
              </span>
              <span className="hidden min-w-0 items-baseline gap-1.5 whitespace-nowrap md:flex">
                <span
                  className={cn(
                    'text-[12px] font-medium tabular-nums',
                    full ? 'text-positive' : isCur ? 'text-brand-text' : 'text-ink-muted',
                  )}
                >
                  {p.done}/{p.total}
                </span>
                {p.range ? <span className="truncate text-[11.5px] text-ink-muted">{p.range}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      {pickedPhase ? (
        <p className="text-[13px] md:hidden">
          <b className="font-medium">{pickedPhase.label}</b>
          <span className="text-ink-muted tabular-nums">
            {' '}
            · {pickedPhase.done}/{pickedPhase.total}
            {pickedPhase.range ? ` · ${pickedPhase.range}` : ''}
          </span>
        </p>
      ) : null}
    </div>
  );
}
