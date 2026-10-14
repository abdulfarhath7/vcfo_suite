'use client';

import { memo } from 'react';
import { useClientOverview } from '@/lib/use-client-overview';
import { SidebarNavCountBadge, SidebarRailBadge } from '@/components/shell/SidebarNavGroup';
import { cn } from '@/lib/utils';

/** "6/14" beside Incorporation — steps done of the whole journey. */
export const ClientIncorporationMeta = memo(function ClientIncorporationMeta({ ink }: { ink: 'light' | 'dark' }) {
  const { data } = useClientOverview();
  const progress = data?.overview?.progress;
  if (!progress || progress.total === 0) return null;
  return (
    <span
      className={cn('mono text-[10.5px] tabular-nums', ink === 'light' ? 'text-white/75' : 'text-muted-foreground')}
      aria-label={`${progress.done} of ${progress.total} steps complete`}
    >
      {progress.done}/{progress.total}
    </span>
  );
});

function useUploadsNeeded(): number {
  const { data } = useClientOverview();
  return data?.overview?.needs?.filter((need) => need.action === 'upload').length ?? 0;
}

/** Documents still to upload, beside Documents. */
export const ClientUploadsBadge = memo(function ClientUploadsBadge({ stacked = false }: { stacked?: boolean }) {
  const count = useUploadsNeeded();
  return stacked ? <SidebarRailBadge count={count} /> : <SidebarNavCountBadge count={count} />;
});
