import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { isAwaitingReview, isLeadRequestPending } from '@/lib/checklist/checklist-item-review';

/**
 * WHO HOLDS THE WORK NOW (BR-03). One function for every role and every step, so the Lead, the
 * Manager, the Admin and the Client read the same holder for the same step. The Client used to
 * read "<Lead> is working on it" whatever the real state was.
 *
 *   Real workflow state                      Holder     Chip
 *   Lead prepares the draft                  lead       With Lead
 *   Lead sent it for approval                manager    With Manager (approval)
 *   Manager approved, Admin to approve       admin      With Admin (approval)
 *   The firm sent it to the Client           client     With you (the Client reads "With you")
 *   Client requested a change                lead       With Lead
 *   Filed with MCA                           mca        With MCA
 *
 * A step that is done or has not started has no holder.
 */

export type WorkHolder = 'lead' | 'manager' | 'admin' | 'client' | 'mca';

/** The facts the holder is read from; `PortalStep` (the client step model) has all of them. */
export interface WorkHolderInput {
  /** `done`, `you` (the client's move), `prog` (the client started), `with` (the firm or MCA), `up`, `next`. */
  kind: string;
  /** Who the step belongs to in the catalog. */
  owner: 'client' | 'sbc' | 'mca';
  slice?: ChecklistItemStateSlice | null;
}

export function workHolder(step: WorkHolderInput): WorkHolder | null {
  if (step.kind === 'you' || step.kind === 'prog') return 'client';
  if (step.kind !== 'with') return null;
  if (step.owner === 'mca') return 'mca';
  const slice = step.slice;
  // A request for approval waits on the manager first and, once the manager approves, on the admin.
  if (isLeadRequestPending(slice) || isAwaitingReview(slice)) return slice?.approvalStage === 'admin' ? 'admin' : 'manager';
  return 'lead';
}

const LABEL: Record<WorkHolder, string> = {
  lead: 'With Lead',
  manager: 'With Manager (approval)',
  admin: 'With Admin (approval)',
  client: 'With Client',
  mca: 'With MCA',
};

/** The chip text. The Client reads "With you" where staff read "With Client". */
export function workHolderLabel(holder: WorkHolder, viewer: 'client' | 'staff' = 'staff'): string {
  if (holder === 'client' && viewer === 'client') return 'With you';
  return LABEL[holder];
}

/** "2 hours", "3 days": the time since the hand-over, in the largest whole unit. */
export function sinceHandOver(sinceIso: string | null | undefined, now: Date = new Date()): string | null {
  if (!sinceIso) return null;
  const then = new Date(sinceIso).getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.floor((now.getTime() - then) / 60000));
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
