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
import { useComplianceFilings } from '@/hooks/use-compliance-filings';
import { buildInternWorkItems, internAssignedToEngagement, internWorkKpis } from '@/lib/intern-work';

/** Intern-scoped engagements, checklist queue, and progress from AppContext. */
export function useInternPortfolio() {
  const { user, engagements, requests, getStateForEngagement } = useApp();
  const internId = user?.internId ?? '';

  const myEngagements = useMemo(
    () => (internId ? engagements.filter((e) => internAssignedToEngagement(e, internId)) : []),
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

  const myRequests = useMemo(
    () => requests.filter((r) => myEngagements.some((e) => e.id === r.engagementId)),
    [requests, myEngagements],
  );

  const pendingRequests = useMemo(
    () => myRequests.filter((r) => r.status === 'pending').length,
    [myRequests],
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

  const filings = useComplianceFilings(myEngagements, getStateForEngagement);

  const workItems = useMemo(
    () =>
      buildInternWorkItems({
        engagements: myEngagements,
        getChecklistState: getStateForEngagement,
        internId,
        filings,
        requests: myRequests,
      }),
    [myEngagements, getStateForEngagement, internId, filings, myRequests],
  );

  const kpis = useMemo(() => internWorkKpis(workItems, new Date()), [workItems]);

  return {
    myEngagements,
    queue,
    stats,
    progressByEngagement,
    focusActions,
    filings,
    myRequests,
    workItems,
    kpis,
  };
}
