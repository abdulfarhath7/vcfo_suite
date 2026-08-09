'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import {
  buildInternPortfolioQueue,
  engagementSetupProgressPercent,
  internQueueStats,
  prioritizeInternActions,
} from '@/lib/intern-dashboard';
import type { BoardResolutionProgressSnapshot } from '@/lib/client-progress-board';

/** Intern-scoped engagements, checklist queue, and progress from AppContext. */
export function useInternPortfolio() {
  const { user, engagements, requests, getStateForEngagement } = useApp();
  const internId = user?.internId ?? '';

  const myEngagements = useMemo(
    () => (internId ? engagements.filter((e) => e.internId === internId) : []),
    [engagements, internId],
  );

  const boardResolutionByEngagement = useMemo(
    () => ({} as Record<string, BoardResolutionProgressSnapshot>),
    [],
  );

  const queue = useMemo(
    () =>
      buildInternPortfolioQueue(
        myEngagements,
        getStateForEngagement,
        internId,
        boardResolutionByEngagement,
      ),
    [myEngagements, getStateForEngagement, internId, boardResolutionByEngagement],
  );

  const pendingRequests = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === 'pending' &&
          myEngagements.some((e) => e.id === r.engagementId),
      ).length,
    [requests, myEngagements],
  );

  const stats = useMemo(
    () => internQueueStats(queue, pendingRequests),
    [queue, pendingRequests],
  );

  const progressByEngagement = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of myEngagements) {
      map.set(
        e.id,
        engagementSetupProgressPercent(
          getStateForEngagement(e),
          boardResolutionByEngagement[e.id],
        ),
      );
    }
    return map;
  }, [myEngagements, getStateForEngagement, boardResolutionByEngagement]);

  const focusActions = useMemo(() => prioritizeInternActions(queue), [queue]);

  return { myEngagements, queue, stats, progressByEngagement, focusActions };
}
