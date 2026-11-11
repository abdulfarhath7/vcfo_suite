import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { isAwaitingReview, isLeadRequestPending } from '@/lib/checklist/checklist-item-review';
import { clientEditHolder } from '@/lib/board-resolution/client-edit';

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
 *   A client edit was returned (BR-05)       lead_client With Lead and Client (the Client reads "With Lead and you")
 *   Filed with MCA                           mca        With MCA
 *
 * The Client reads the first name of the Lead and the Manager after the role ("With Lead · Divya",
 * "With Manager · Anita") and the Admin by role only ("With Admin"); staff read the role only.
 * A step that is done or has not started has no holder.
 */

export type WorkHolder = 'lead' | 'manager' | 'admin' | 'client' | 'lead_client' | 'mca';

/** The engagement's Lead and Manager, as full names; the Client's chip shows their first names. */
export interface WorkHolderTeam {
  lead?: string | null;
  manager?: string | null;
}

/** The facts the holder is read from; `PortalStep` (the client step model) has all of them. */
export interface WorkHolderInput {
  /** `done`, `you` (the client's move), `prog` (the client started), `with` (the firm or MCA), `up`, `next`. */
  kind: string;
  /** Who the step belongs to in the catalog. */
  owner: 'client' | 'sbc' | 'mca';
  slice?: ChecklistItemStateSlice | null;
}

export function workHolder(step: WorkHolderInput): WorkHolder | null {
  // BR-05: a client edit of the board resolution names its own holder at each stage.
  const edit = step.slice?.brClientEdit;
  if (edit && edit.stage !== 'final') return clientEditHolder(edit.stage);
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
  lead_client: 'With Lead and Client',
  mca: 'With MCA',
};

/** "Divya" from "Divya Rao". An email address (the fallback name of a person) is not a name. */
function firstNameOf(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return first.includes('@') ? '' : first;
}

/**
 * The chip text. Staff read the role. The Client reads "With you" for their own move, the role and
 * the first name for the Lead and the Manager (owner decision of 11 Nov), and the role alone for
 * the Admin. Without a name the Client reads the role alone.
 */
export function workHolderLabel(holder: WorkHolder, viewer: 'client' | 'staff' = 'staff', team?: WorkHolderTeam): string {
  if (viewer === 'staff') return LABEL[holder];
  const named = (role: string, name: string | null | undefined) => {
    const first = firstNameOf(name);
    return first ? `With ${role} · ${first}` : `With ${role}`;
  };
  switch (holder) {
    case 'client':
      return 'With you';
    case 'lead':
      return named('Lead', team?.lead);
    case 'manager':
      return named('Manager', team?.manager);
    case 'admin':
      return 'With Admin';
    case 'lead_client':
      return `${named('Lead', team?.lead)} and you`;
    default:
      return LABEL[holder];
  }
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
