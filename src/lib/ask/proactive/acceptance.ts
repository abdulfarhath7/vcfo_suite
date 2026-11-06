/**
 * What people did with each action's cards, from `ask_changeset_rows.status`. A row accepted, turned
 * down, undone or left to expire counts as answered; a row that failed says nothing about the proposal,
 * and one still open has not been answered yet. This only reports: nothing reads it to change a tier.
 */
export interface CardRowCount {
  action: string;
  trigger: string;
  status: string;
  edited: boolean;
  expired: boolean;
  rows: number;
}

export interface ActionAcceptance {
  action: string;
  /** `chat` or `schedule`. */
  trigger: string;
  proposed: number;
  accepted: number;
  /** Of `accepted`, rows a person corrected first. */
  acceptedEdited: number;
  turnedDown: number;
  undone: number;
  expired: number;
  waiting: number;
  failed: number;
  /** Accepted over answered; null with nothing answered. */
  acceptedRate: number | null;
  /** Accepted exactly as proposed over answered: the master plan's test for more autonomy. */
  uneditedRate: number | null;
}

const OPEN: ReadonlySet<string> = new Set(['proposed', 'accepted', 'edited', 'held']);

export function acceptanceByAction(counts: readonly CardRowCount[]): ActionAcceptance[] {
  const byAction = new Map<string, ActionAcceptance>();
  for (const { action, trigger, status, edited, expired, rows } of counts) {
    const key = `${action}:${trigger}`;
    const row = byAction.get(key) ?? { action, trigger, proposed: 0, accepted: 0, acceptedEdited: 0, turnedDown: 0, undone: 0, expired: 0, waiting: 0, failed: 0, acceptedRate: null, uneditedRate: null };
    byAction.set(key, row);
    row.proposed += rows;
    if (status === 'applied') {
      row.accepted += rows;
      if (edited) row.acceptedEdited += rows;
    } else if (status === 'skipped') row.turnedDown += rows;
    else if (status === 'undone') row.undone += rows;
    else if (status === 'failed') row.failed += rows;
    else if (OPEN.has(status)) {
      if (expired) row.expired += rows;
      else row.waiting += rows;
    }
  }
  for (const row of byAction.values()) {
    const answered = row.accepted + row.turnedDown + row.undone + row.expired;
    row.acceptedRate = answered > 0 ? row.accepted / answered : null;
    row.uneditedRate = answered > 0 ? (row.accepted - row.acceptedEdited) / answered : null;
  }
  return [...byAction.values()].sort((a, b) => b.proposed - a.proposed || a.action.localeCompare(b.action));
}
