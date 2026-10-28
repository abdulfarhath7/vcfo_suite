import { StepMark } from '@/components/ui/step-track';
import { cn } from '@/lib/utils';

export interface Phase {
  key: string;
  label: string;
  percent: number;
  status: 'completed' | 'in-progress' | 'not-started';
}

interface PhaseTimelineProps {
  phases: Phase[];
  /** Vertical list (default) or horizontal journey map */
  variant?: 'vertical' | 'journey';
}

/* Colour carries status only (R-25): a finished phase is green, the phase in flight is
   blurple, a phase not started is grey. Each phase shows the ST5 step mark (R-22), its name,
   its percentage and a 6px bar. */
const STATE = { completed: 'done', 'in-progress': 'now', 'not-started': 'next' } as const;
const WORD = { completed: 'Done', 'in-progress': 'In progress', 'not-started': 'Not started' } as const;

function PhaseBarLine({ p }: { p: Phase }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-bar bg-surface-sunken">
        {p.percent > 0 ? (
          <i
            className={cn('absolute inset-y-0 left-0 rounded-bar', p.status === 'completed' ? 'bg-positive-mid' : 'bg-brand')}
            style={{ width: `${p.percent}%` }}
          />
        ) : null}
      </span>
      <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-ink-muted">{p.percent}%</span>
    </span>
  );
}

export function PhaseTimeline({ phases, variant = 'vertical' }: PhaseTimelineProps) {
  if (variant === 'journey') {
    return (
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-3">
        {phases.map((p) => (
          <li key={p.key} className="flex min-w-0 flex-col gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <StepMark state={STATE[p.status]} size={20} label={`${p.label} · ${WORD[p.status]}`} />
              <span className="min-w-0 truncate text-[13.5px] font-medium text-ink">{p.label}</span>
            </span>
            <PhaseBarLine p={p} />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="grid gap-4">
      {phases.map((p) => (
        <li key={p.key} className="flex min-w-0 items-center gap-3">
          <StepMark state={STATE[p.status]} label={`${p.label} · ${WORD[p.status]}`} />
          <span className="min-w-0 flex-1">
            <span className="mb-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-[13.5px] font-medium text-ink">{p.label}</span>
              <span className="shrink-0 text-[12px] text-ink-muted">{WORD[p.status]}</span>
            </span>
            <PhaseBarLine p={p} />
          </span>
        </li>
      ))}
    </ol>
  );
}
