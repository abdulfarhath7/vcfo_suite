import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { checklist } from '@/data/checklist';
import { isAwaitingReview } from '@/lib/checklist-item-review';

/** Why a Pre/Post incorporation project is stuck. */
export type StuckReason =
  | 'waiting_client'
  | 'waiting_manager'
  | 'waiting_lead'
  | 'waiting_signed'
  | 'blocked'
  | 'on_track';

export const STUCK_LABEL: Record<StuckReason, string> = {
  waiting_client: 'Waiting on client',
  waiting_manager: 'Waiting on manager approval',
  waiting_lead: 'Waiting on project lead',
  waiting_signed: 'Waiting on signed return',
  blocked: 'Blocked',
  on_track: 'On track',
};

const PRIMARY_BUCKETS = new Set(['pre-inc', 'post-inc']);

export const PRIMARY_BUCKETS_SET = PRIMARY_BUCKETS;

export function deriveStuckReason(
  engagement: Engagement,
  checklistState: Record<string, ChecklistItemStateSlice>,
): StuckReason {
  if (engagement.stage === 'Operational Readiness') {
    // Out of primary scope — treat as on track for firm pulse.
    return 'on_track';
  }

  const items = checklist.filter((i) => PRIMARY_BUCKETS.has(i.bucket));
  let waitingClient = false;
  let waitingManager = false;
  let waitingLead = false;
  let overdue = false;

  for (const item of items) {
    const slice = checklistState[item.id];
    if (!slice) {
      waitingLead = true;
      continue;
    }
    if (slice.status === 'overdue') overdue = true;
    if (slice.status === 'awaiting-client') waitingClient = true;
    if (isAwaitingReview(slice)) waitingManager = true;
    if (slice.reviewStatus === 'rejected') waitingLead = true;
    if (slice.status === 'not-started' || slice.status === 'in-progress') waitingLead = true;
  }

  if (overdue) return 'blocked';
  if (waitingManager) return 'waiting_manager';
  if (waitingClient) return 'waiting_client';
  if (waitingLead) return 'waiting_lead';
  return 'on_track';
}

/** Pre + Post incorporation checklist items only. */
export function primaryPhaseItems() {
  return checklist.filter((i) => PRIMARY_BUCKETS.has(i.bucket));
}
