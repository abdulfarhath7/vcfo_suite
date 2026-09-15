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
import { useFilings } from '@/lib/use-filings';
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
  // Manager-set compliance windows live on the DB register rows; the Today
  // filings are computed client-side, so join them by the shared instance key.
  const register = useFilings();
  const filingWindows = useMemo(() => {
    const out: Record<string, { from: string; to: string }> = {};
    for (const row of register.data?.rows ?? []) {
      if (!row.windowFrom || !row.windowTo) continue;
      out[`${row.engagementId}:${row.obligationId}:${row.dueDate}:${row.periodLabel ?? ''}`] = {
        from: row.windowFrom,
        to: row.windowTo,
      };
    }
    return out;
  }, [register.data]);

  const workItems = useMemo(
    () =>
      buildInternWorkItems({
        engagements: myEngagements,
        getChecklistState: getStateForEngagement,
        internId,
        filings,
        filingWindows,
        requests: myRequests,
      }),
    [myEngagements, getStateForEngagement, internId, filings, filingWindows, myRequests],
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
