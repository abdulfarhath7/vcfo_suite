'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The shared plot frame: fixed height, the canonical loading skeleton, and the
 * canonical in-panel empty state. Every chart sits in one of these, so a chart
 * that is loading, empty, or drawn looks the same wherever it appears.
 *
 * Not a panel — charts live INSIDE a `DashSection`, never as a bare card.
 */
export function ChartFrame({
  height = 176,
  loading,
  empty,
  emptyLabel = 'Nothing to chart yet.',
  className,
  children,
}: {
  height?: number;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div
        className={cn('w-full animate-pulse rounded-md bg-muted/40', className)}
        style={{ height }}
        aria-hidden
      />
    );
  }

  if (empty) {
    return (
      <div
        className={cn('grid w-full place-items-center', className)}
        style={{ height }}
      >
        <p className="text-[12.5px] text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      {children}
    </div>
  );
}
