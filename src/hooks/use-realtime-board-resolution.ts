'use client';

import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { usePollRefresh } from '@/hooks/use-poll-refresh';

/** Refetch the board resolution when it may have changed elsewhere (visibility-aware poll). */
export interface UseRealtimeBoardResolutionOptions {
  appEngagementId: string | undefined;
  enabled?: boolean;
  onRemoteChange: () => void;
}

export function useRealtimeBoardResolution({
  appEngagementId,
  enabled = true,
  onRemoteChange,
}: UseRealtimeBoardResolutionOptions): void {
  const dbId = appEngagementId ? engagementDbId(appEngagementId) : undefined;

  usePollRefresh({
    enabled: Boolean(enabled && dbId),
    onRefresh: onRemoteChange,
  });
}
