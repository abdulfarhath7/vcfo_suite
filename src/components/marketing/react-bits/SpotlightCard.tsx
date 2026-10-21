'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  /** Kept for callers; the mouse-tracking radial spotlight no longer renders. */
  spotlightColor?: string;
};

/** Raised card with a hairline; hover lifts it a step (surface-sunken tint). */
export default function SpotlightCard({ children, className = '' }: SpotlightCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-line bg-surface-raised p-6 shadow-card transition-colors duration-150 hover:bg-surface-sunken sm:p-7',
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
