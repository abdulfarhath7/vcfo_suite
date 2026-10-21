'use client';

import { Check, Clock } from 'lucide-react';
import type { ChecklistStepGate } from '@/lib/checklist/checklist-step-gate';
import { cn } from '@/lib/utils';

type JourneyNodeProps = {
  kind: ChecklistStepGate['kind'];
  stepNumber?: number;
  selected?: boolean;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Shared journey node language — blue current, teal-green done, amber clock
 * waiting, dashed slate upcoming.
 *
 * Upcoming steps show their step number, never a padlock: the sequential gate
 * is unchanged, but the UI states it in words ("This opens after X is
 * complete") rather than with a locked-out glyph.
 */
export function JourneyNode({
  kind,
  stepNumber,
  selected = false,
  size = 'md',
  className,
}: JourneyNodeProps) {
  const dim = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[11px]';
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  if (kind === 'done') {
    return (
      <span
        className={cn(
          'relative z-[1] flex items-center justify-center rounded-full border border-positive bg-positive text-on-brand shadow-sm journey-complete',
          dim,
          selected && 'ring-4 ring-brand/25',
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
          'relative z-[1] flex items-center justify-center rounded-full border-2 border-brand bg-brand font-semibold text-on-brand shadow-sm journey-node-pulse',
          dim,
          selected && 'ring-4 ring-brand/30',
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
          'relative z-[1] flex items-center justify-center rounded-full border border-line bg-surface-raised text-warning shadow-sm',
          dim,
          selected && 'ring-4 ring-brand/25',
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
        'relative z-[1] flex items-center justify-center rounded-full border border-dashed border-line bg-surface-sunken/40 text-ink-muted',
        dim,
        selected && 'ring-4 ring-brand/25',
        className,
      )}
    >
      {stepNumber ?? <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />}
    </span>
  );
}
