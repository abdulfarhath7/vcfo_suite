import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** R-48: an empty state is a dashed area with the action. No filler sentence about the obvious. */
export function EmptyState({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-[96px] flex-col items-center justify-center gap-2.5 rounded-md border-1.5 border-dashed border-line-strong px-4 py-6 text-center text-[14px] text-ink-muted',
        className,
      )}
    >
      <span>{title}</span>
      {action}
    </div>
  );
}

/** R-48: loading shows grey shapes. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('grid gap-2', className)} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="block h-11 animate-pulse rounded-md bg-surface-sunken" />
      ))}
    </div>
  );
}
