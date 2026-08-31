import { cn } from '@/lib/utils';

/**
 * Loading state — brand skeletons in the real layout, never the full-screen
 * "Opening VCFO Suite…" boot screen. The page keeps its shape while the one
 * scoped read lands, so nothing jumps when data arrives.
 */
export function ClientOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading your dashboard">
      <div className="lead-hero px-5 py-4 sm:px-6 sm:py-5">
        <div className="space-y-2.5">
          <Bar className="h-3 w-40 bg-white/20" />
          <div className="flex items-start justify-between gap-4">
            <Bar className="h-8 w-[min(20rem,70%)] bg-white/20" />
            <Bar className="h-14 w-14 shrink-0 rounded-full bg-white/20" />
          </div>
          <div className="h-px bg-white/12" />
          <div className="flex gap-4">
            <Bar className="h-4 w-32 bg-white/20" />
            <Bar className="h-4 w-28 bg-white/20" />
          </div>
        </div>
      </div>

      <Bar className="h-[112px] w-full" />

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
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
