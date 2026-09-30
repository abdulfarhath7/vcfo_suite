'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { listPendingApprovals, type PendingApprovalRow } from '@/lib/pending-approvals';

export { pendingApprovalKind, type PendingApprovalRow } from '@/lib/pending-approvals';

export type PendingApprovalScope = 'firm' | 'manager';

/**
 * Every step waiting on a manager or admin decision, across the projects the
 * viewer owns. One source for the Approvals inbox and the dashboard panel so
 * both surfaces always agree.
 */
export function usePendingApprovals(scope: PendingApprovalScope): PendingApprovalRow[] {
  const { engagements, getStateForEngagement, user } = useApp();

  return useMemo(() => {
    const visible = engagements.filter(
      (eng) => !(scope === 'manager' && user?.role === 'manager' && eng.managerId && eng.managerId !== user.id),
    );
    return listPendingApprovals(visible, (eng) => getStateForEngagement(eng as (typeof engagements)[number]));
  }, [engagements, getStateForEngagement, scope, user]);
}
