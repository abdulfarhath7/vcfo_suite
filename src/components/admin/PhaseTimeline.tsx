import { m } from 'framer-motion';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CATEGORICAL_TONES,
  TONE_BADGE,
  TONE_BG,
  TONE_TEXT,
  type IconChipTone,
} from '@/components/common/IconChip';

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

/* Each phase keeps its own hue across the journey, so the timeline reads as
   a colorful map rather than a monochrome list. */
function phaseTone(i: number): IconChipTone {
  return CATEGORICAL_TONES[i % CATEGORICAL_TONES.length];
}

function PhaseNode({ p, i }: { p: Phase; i: number }) {
  const tone = phaseTone(i);
  const Icon = p.status === 'completed' ? CheckCircle2 : p.status === 'in-progress' ? Clock : Circle;
  const iconCls =
    p.status === 'completed'
      ? 'text-positive'
      : p.status === 'in-progress'
        ? TONE_TEXT[tone]
        : 'text-ink-muted';
  const chipCls =
    p.status === 'completed'
      ? 'bg-positive/10 text-positive border border-positive/20'
      : p.status === 'in-progress'
        ? cn(TONE_BADGE[tone], 'border border-transparent')
        : 'bg-surface-sunken text-ink-muted border border-line';
  const label = p.status === 'completed' ? 'Complete' : p.status === 'in-progress' ? 'In progress' : 'Not started';

  return (
    <>
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0 border',
          p.status === 'in-progress'
            ? cn(TONE_BADGE[tone], 'border-transparent animate-gold-pulse')
            : 'border-line bg-surface-sunken',
        )}
      >
        <Icon className={cn('w-4 h-4', iconCls)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-sm font-medium text-ink truncate">{p.label}</span>
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded mono uppercase tracking-wider shrink-0', chipCls)}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
            <m.div
              initial={{ width: 0 }}
              animate={{ width: `${p.percent}%` }}
              transition={{ duration: 0.9, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'h-full rounded-full',
                p.status === 'completed' ? 'bg-positive' : p.status === 'in-progress' ? TONE_BG[tone] : 'bg-muted-foreground/30',
              )}
            />
          </div>
          <span className="text-[11px] mono tabular-nums text-ink-muted w-9 text-right">{p.percent}%</span>
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
            const tone = phaseTone(i);
            return (
              <div key={p.key} className="relative flex md:flex-col md:items-center md:text-center gap-3 md:gap-2">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0 border z-10',
                    p.status === 'in-progress' ? cn(TONE_BADGE[tone], 'border-transparent') : 'border-line bg-surface-raised',
                  )}
                >
                  {p.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-positive" />
                  ) : p.status === 'in-progress' ? (
                    <Clock className={cn('w-4 h-4', TONE_TEXT[tone])} />
                  ) : (
                    <Circle className="w-4 h-4 text-ink-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1 md:flex-none">
                  <div className="text-sm font-medium text-ink">{p.label}</div>
                  <div className="text-[10px] mono uppercase tracking-wider text-ink-muted mt-0.5">{p.percent}%</div>
                  <div className="mt-2 h-1 rounded-full bg-surface-sunken overflow-hidden md:w-full max-w-[120px] md:mx-auto">
                    <m.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.percent}%` }}
                      transition={{ duration: 0.9, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
                      className={cn('h-full rounded-full', p.status === 'completed' ? 'bg-positive' : p.status === 'in-progress' ? TONE_BG[tone] : 'bg-muted-foreground/30')}
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
