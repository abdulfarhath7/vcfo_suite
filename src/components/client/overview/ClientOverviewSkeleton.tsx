import { cn } from '@/lib/utils';

/**
 * Loading state — brand skeletons in the real layout, never the full-screen
 * "Opening VCFO Suite…" boot screen. The page keeps its shape while the one
 * scoped read lands, so nothing jumps when data arrives.
 */
export function ClientOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading your dashboard">
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Bar className="h-[132px]" />
          <Bar className="h-[88px]" />
          <Bar className="h-[210px]" />
          <Bar className="h-[240px]" />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Bar className="h-[150px]" />
          <Bar className="h-[190px]" />
        </div>
      </div>
    </div>
  );
}

function Bar({ className }: { className?: string }) {
  return <div className={cn('skeleton-brand rounded-[var(--radius)]', className)} aria-hidden />;
}
