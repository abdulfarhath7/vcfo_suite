'use client';

import { Check, Clock, Lock } from 'lucide-react';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { cn } from '@/lib/utils';

type JourneyNodeProps = {
  kind: ChecklistStepGate['kind'];
  stepNumber?: number;
  selected?: boolean;
  size?: 'sm' | 'md';
  /** Intern/lead rail: upcoming steps stay numbered, never a lock glyph. */
  showLock?: boolean;
  className?: string;
};

/** Shared journey node language — blue current, teal-green done, amber icon waiting, slate lock. */
export function JourneyNode({
  kind,
  stepNumber,
  selected = false,
  size = 'md',
  showLock = true,
  className,
}: JourneyNodeProps) {
  const dim = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[11px]';
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  if (kind === 'done') {
    return (
      <span
        className={cn(
          'relative z-[1] flex items-center justify-center rounded-full border border-success bg-success text-success-foreground shadow-sm journey-complete',
          dim,
          selected && 'ring-4 ring-primary/25',
          className,
        )}
      >
        <Check className={icon} strokeWidth={2.75} aria-hidden />
      </span>
    );
  }

  if (kind === 'active') {
    return (
      <span
        className={cn(
          'relative z-[1] flex items-center justify-center rounded-full border-2 border-primary bg-primary font-bold text-primary-foreground shadow-sm journey-node-pulse',
          dim,
          selected && 'ring-4 ring-primary/30',
          className,
        )}
      >
        {stepNumber ?? <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
    );
  }

  if (kind === 'waiting') {
    return (
      <span
        className={cn(
          'relative z-[1] flex items-center justify-center rounded-full border border-border bg-panel text-warning-text shadow-sm',
          dim,
          selected && 'ring-4 ring-primary/25',
          className,
        )}
      >
        <Clock className={icon} aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'relative z-[1] flex items-center justify-center rounded-full border border-dashed border-border bg-muted/40 text-muted-foreground',
        dim,
        selected && 'ring-4 ring-primary/25',
        className,
      )}
    >
      {showLock ? (
        <Lock className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden />
      ) : (
        (stepNumber ?? <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />)
      )}
    </span>
  );
}
