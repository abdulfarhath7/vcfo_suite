'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Header-bar done = green tick; otherwise an empty circle (no lock / status words). */
export function InternStepDoneMark({
  done,
  className,
  decorative,
}: {
  done: boolean;
  className?: string;
  decorative?: boolean;
}) {
  const iconClass = cn(
    'h-4 w-4 shrink-0 justify-self-center',
    done ? 'text-success' : 'text-muted-foreground',
    className,
  );
  if (done) {
    return (
      <CheckCircle2
        className={iconClass}
        strokeWidth={2.25}
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : 'Complete'}
      />
    );
  }
  return (
    <Circle
      className={iconClass}
      strokeWidth={1.75}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'Incomplete'}
    />
  );
}
