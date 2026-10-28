'use client';

import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

/**
 * The shared plot frame: fixed height, the grey loading shape and the dashed empty
 * state (R-48). Every chart sits in one of these, so a chart
 * that is loading, empty, or drawn looks the same wherever it appears.
 *
 * Not a panel — charts live INSIDE a `DashSection`, never as a bare card.
 */
export function ChartFrame({
  height = 176,
  loading,
  empty,
  emptyLabel = 'Nothing to chart yet',
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
        className={cn('w-full animate-pulse rounded-md bg-surface-sunken', className)}
        style={{ height }}
        aria-hidden
      />
    );
  }

  if (empty) {
    return (
      <div className={cn('grid w-full', className)} style={{ height }}>
        <EmptyState title={emptyLabel} className="h-full" />
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      {children}
    </div>
  );
}
