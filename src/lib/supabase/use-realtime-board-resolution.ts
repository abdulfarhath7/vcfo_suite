'use client';

import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { usePollRefresh } from '@/lib/supabase/use-poll-refresh';

/**
 * Refetch the board resolution when it may have changed elsewhere.
 *
 * Was a Supabase Realtime subscription on `engagement_board_resolutions`
 * filtered by engagement_id; now a visibility-aware poll (see usePollRefresh).
 * The `supabase` option is gone — callers no longer hold a client.
 */
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
