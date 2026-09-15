'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { isAwaitingReview } from '@/lib/checklist-item-review';
import { isClientFillPending } from '@/lib/checklist-client-fill';
import { primaryPhaseItems } from '@/lib/project-stuck';

export type PendingApprovalScope = 'firm' | 'manager';

export type PendingApprovalRow = {
  engagementId: string;
  companyName: string;
  itemId: string;
  slug?: string;
  /** `lead_manager_request` when the lead asked for sign-off; otherwise a client submit. */
  reviewSource?: string;
  /** Lead is asking to send this step to the client — approve before it goes out. */
  clientFill?: { requestedByName?: string; note?: string };
};

/**
 * Every step waiting on a manager or admin decision, across the projects the
 * viewer owns. One source for the Approvals inbox and the dashboard panel so
 * both surfaces always agree.
 */
export function usePendingApprovals(scope: PendingApprovalScope): PendingApprovalRow[] {
  const { engagements, getStateForEngagement, user } = useApp();

  return useMemo(() => {
    const out: PendingApprovalRow[] = [];
    for (const eng of engagements) {
      if (eng.stage === 'Operational Readiness') continue;
      if (scope === 'manager' && user?.role === 'manager' && eng.managerId && eng.managerId !== user.id) {
        continue;
      }
      const state = getStateForEngagement(eng);
      for (const item of primaryPhaseItems()) {
        const slice = state[item.id];
        if (isAwaitingReview(slice)) {
          out.push({
            engagementId: eng.id,
            companyName: eng.companyName,
            itemId: item.id,
            slug: eng.slug,
            reviewSource: slice?.reviewSource,
          });
        }
        if (isClientFillPending(slice?.clientFillRequest)) {
          out.push({
            engagementId: eng.id,
            companyName: eng.companyName,
            itemId: item.id,
            slug: eng.slug,
            clientFill: {
              requestedByName: slice?.clientFillRequest?.requestedByName,
              note: slice?.clientFillRequest?.note,
            },
          });
        }
      }
    }
    return out;
  }, [engagements, getStateForEngagement, scope, user]);
}

export function pendingApprovalKind(row: PendingApprovalRow): string {
  if (row.clientFill) {
    return `Send to client${row.clientFill.requestedByName ? ` · ${row.clientFill.requestedByName}` : ''}`;
  }
  return row.reviewSource === 'lead_manager_request' ? 'Lead request' : 'Client submit';
}
