'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import {
  buildInternPortfolioQueue,
  engagementSetupProgressPercent,
  internQueueStats,
  prioritizeInternActions,
} from '@/lib/intern/intern-dashboard';
import type { BoardResolutionProgressSnapshot } from '@/lib/client/client-progress-board';
import { useComplianceFilings } from '@/hooks/use-compliance-filings';
import { useFilings } from '@/hooks/use-filings';
import { complianceEngagementsForRole } from '@/lib/compliance/incorporation-state';
import { internWorkKpis } from '@/lib/intern/intern-work';
import { leadEngagements, leadFilingWindows, leadWorkItems } from '@/lib/intern/lead-portfolio';

/** Intern-scoped engagements, checklist queue, and progress from AppContext. */
export function useInternPortfolio() {
  const { user, engagements, requests, tasks, getStateForEngagement } = useApp();
  const internId = user?.internId ?? '';

  const myEngagements = useMemo(() => leadEngagements(engagements, internId), [engagements, internId]);

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

  // Compliances exist for the lead only once a company is incorporated
  // (`isIncorporated`, incl. Registration / Compliance starts). Incorporation
  // steps for the others still flow through `myEngagements` below.
  const incorporatedEngagements = useMemo(
    () => complianceEngagementsForRole('intern', myEngagements, getStateForEngagement),
    [myEngagements, getStateForEngagement],
  );
  const filings = useComplianceFilings(incorporatedEngagements, getStateForEngagement);
  // Manager-set compliance windows live on the DB register rows; the Today
  // filings are computed client-side, so join them by the shared instance key.
  const register = useFilings();
  const filingWindows = useMemo(() => leadFilingWindows(register.data?.rows ?? []), [register.data]);

  // The same builder as the server's Excel export of the lead's Clients (GL-06).
  const userId = user?.id ?? '';
  const workItems = useMemo(
    () =>
      leadWorkItems({
        myEngagements,
        stateOf: getStateForEngagement,
        internId,
        userId,
        filings,
        filingWindows,
        requests: myRequests,
        tasks,
      }),
    [myEngagements, getStateForEngagement, internId, userId, filings, filingWindows, myRequests, tasks],
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
