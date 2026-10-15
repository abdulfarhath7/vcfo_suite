import { m } from 'framer-motion';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
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

const BAR: Record<Phase['status'], string> = {
  completed: 'bg-[oklch(40%_0.045_168)]',
  'in-progress': 'bg-[oklch(30%_0.028_255)]',
  'not-started': 'bg-[oklch(78%_0.012_255)]',
};

const ICON: Record<Phase['status'], string> = {
  completed: 'text-[oklch(40%_0.045_168)]',
  'in-progress': 'text-[oklch(30%_0.028_255)]',
  'not-started': 'text-muted-foreground',
};

const CHIP: Record<Phase['status'], string> = {
  completed: 'border border-transparent bg-[oklch(94%_0.02_168)] text-[oklch(32%_0.04_168)]',
  'in-progress': 'border border-transparent bg-[oklch(94%_0.012_255)] text-[oklch(28%_0.03_255)]',
  'not-started': 'border border-border bg-raised text-muted-foreground',
};

function PhaseNode({ p, i }: { p: Phase; i: number }) {
  const Icon = p.status === 'completed' ? CheckCircle2 : p.status === 'in-progress' ? Clock : Circle;
  const iconCls = ICON[p.status];
  const chipCls = CHIP[p.status];
  const label = p.status === 'completed' ? 'Complete' : p.status === 'in-progress' ? 'In progress' : 'Not started';

  return (
    <>
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0 border',
          p.status === 'in-progress'
            ? 'border-transparent bg-[oklch(94%_0.012_255)]'
            : 'border-border bg-raised',
        )}
      >
        <Icon className={cn('w-4 h-4', iconCls)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-sm font-medium text-foreground truncate">{p.label}</span>
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded mono uppercase tracking-wider shrink-0', chipCls)}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-raised overflow-hidden">
            <m.div
              initial={{ width: 0 }}
              animate={{ width: `${p.percent}%` }}
              transition={{ duration: 0.9, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'h-full rounded-full',
                BAR[p.status],
              )}
            />
          </div>
          <span className="text-[11px] mono tabular-nums text-muted-foreground w-9 text-right">{p.percent}%</span>
        </div>
      </div>
    </>
  );
}

export function PhaseTimeline({ phases, variant = 'vertical' }: PhaseTimelineProps) {
  if (variant === 'journey') {
    return (
      <div className="relative">
        <div className="hidden md:block absolute top-5 left-5 right-5 h-px bg-border" aria-hidden />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-3">
          {phases.map((p, i) => {
            return (
              <div key={p.key} className="relative flex md:flex-col md:items-center md:text-center gap-3 md:gap-2">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0 border z-10',
                    p.status === 'in-progress'
                      ? 'border-transparent bg-[oklch(94%_0.012_255)]'
                      : 'border-border bg-panel',
                  )}
                >
                  {p.status === 'completed' ? (
                    <CheckCircle2 className={cn('w-4 h-4', ICON.completed)} />
                  ) : p.status === 'in-progress' ? (
                    <Clock className={cn('w-4 h-4', ICON['in-progress'])} />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 md:flex-none">
                  <div className="text-sm font-medium text-foreground">{p.label}</div>
                  <div className="text-[10px] mono uppercase tracking-wider text-muted-foreground mt-0.5">{p.percent}%</div>
                  <div className="mt-2 h-1 rounded-full bg-raised overflow-hidden md:w-full max-w-[120px] md:mx-auto">
                    <m.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.percent}%` }}
                      transition={{ duration: 0.9, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
                      className={cn('h-full rounded-full', BAR[p.status])}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {phases.map((p, i) => (
        <div key={p.key} className="flex items-center gap-4">
          <PhaseNode p={p} i={i} />
        </div>
      ))}
    </div>
  );
}
