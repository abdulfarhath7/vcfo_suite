import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { isAwaitingReview } from '@/lib/checklist-item-review';
import { isClientFillPending } from '@/lib/checklist-client-fill';
import { primaryPhaseItems } from '@/lib/project-stuck';

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

type ApprovalEngagement = Pick<Engagement, 'id' | 'companyName' | 'slug' | 'stage'>;

/**
 * Every step waiting on a manager or admin decision across `engagements`.
 * Pure so the Approvals inbox (browser) and Ask VCFO's staff tools (server)
 * read the same rule.
 */
export function listPendingApprovals(
  engagements: readonly ApprovalEngagement[],
  stateFor: (engagement: ApprovalEngagement) => Record<string, ChecklistItemStateSlice | undefined>,
): PendingApprovalRow[] {
  const out: PendingApprovalRow[] = [];
  for (const eng of engagements) {
    if (eng.stage === 'Operational Readiness') continue;
    const state = stateFor(eng);
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
}

export function pendingApprovalKind(row: PendingApprovalRow): string {
  if (row.clientFill) {
    return `Send to client${row.clientFill.requestedByName ? ` · ${row.clientFill.requestedByName}` : ''}`;
  }
  return row.reviewSource === 'lead_manager_request' ? 'Lead request' : 'Client submit';
}
