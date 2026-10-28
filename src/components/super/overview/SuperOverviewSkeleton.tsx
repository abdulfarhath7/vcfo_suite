import { cn } from '@/lib/utils';

/**
 * Loading state — grey shapes in the real layout (R-48), never a full-screen boot screen
 * (context §2.8). The page keeps its shape while the scoped reads land, so nothing jumps when
 * the data arrives: the home card with its number tiles, the three practice cards, then the
 * main column and the 318px rail.
 */
export function SuperOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading the firm overview">
      <div className="bg-wash flex flex-col gap-5 rounded-md border-1.5 border-line px-4 pb-5 pt-[18px] md:px-6 md:pb-6 md:pt-[22px]">
        <div className="space-y-2">
          <Shape className="h-3 w-40" />
          <Shape className="h-8 w-[min(20rem,70%)]" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Shape key={i} className="h-[76px]" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Shape className="h-[220px]" />
        <Shape className="h-[220px]" />
        <Shape className="h-[220px]" />
      </div>

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Shape className="h-[300px]" />
          <Shape className="h-[240px]" />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Shape className="h-[260px]" />
          <Shape className="h-[176px]" />
          <Shape className="h-[280px]" />
        </div>
      </div>
    </div>
  );
}

function Shape({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-sunken', className)} aria-hidden />;
}
