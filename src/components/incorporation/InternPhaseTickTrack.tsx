'use client';

import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { getStepGate } from '@/lib/checklist-step-gate';
import { cn } from '@/lib/utils';
import styles from './intern-engagement-overview.module.css';

/**
 * Intern-only LCD/stadium ticks. Parent width is the track length; each
 * catalog step is one equal `1fr` block (more steps → thinner ticks).
 * Restyle with `className` (height, gap, padding). Flip off by not mounting.
 */
export function InternPhaseTickTrack({
  items,
  gates,
  className,
}: {
  items: readonly { id: string; title: string }[];
  gates: Record<string, ChecklistStepGate>;
  className?: string;
}) {
  if (items.length === 0) {
    return <div className={cn(styles.tickTrack, className)} aria-hidden />;
  }

  return (
    <div
      className={cn(styles.tickTrack, className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {items.map((item) => {
        const done = getStepGate(gates, item.id).kind === 'done';
        return (
          <span
            key={item.id}
            title={item.title}
            className={cn(styles.tick, done && styles.tickDone)}
          />
        );
      })}
    </div>
  );
}
