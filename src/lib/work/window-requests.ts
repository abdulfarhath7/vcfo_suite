import { isValidWindowRange } from '@/lib/projects/schedule-windows';

/**
 * A lead asks the manager to move a manager-set date window on one item (G-17).
 * Only steps and filings carry manager windows; the manager approves (the new window
 * is applied through `src/db/repositories/schedule.ts`) or rejects with a note, and
 * the lead may withdraw while the request is pending.
 */
export type WindowRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface WindowRequestDto {
  id: string;
  engagementId: string;
  companyName: string;
  itemKey: string;
  itemTitle: string;
  requestedBy: string;
  requestedByName: string | null;
  fromDate: string | null;
  toDate: string;
  reason: string;
  status: WindowRequestStatus;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  /** The window that applies now, when the item still has one. */
  currentWindow: { from: string; to: string } | null;
}

export function isWindowRequestStatus(value: string): value is WindowRequestStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'withdrawn';
}

/**
 * The window a request asks for. The lead names a new end date and may name a new
 * start; without one the current start stays, pulled back to the end date when the
 * new end is earlier. Returns null when the result is not a valid range.
 */
export function resolveRequestedWindow(
  current: { from: string; to: string } | null,
  ask: { from?: string | null; to: string },
): { from: string; to: string } | null {
  const to = ask.to;
  let from = ask.from ?? current?.from ?? to;
  if (!ask.from && from > to) from = to;
  return isValidWindowRange(from, to) ? { from, to } : null;
}

/** The window kinds a request may target. */
export function windowKindOf(key: string): 'step' | 'filing' | null {
  if (key.startsWith('step:')) return 'step';
  if (key.startsWith('filing:')) return 'filing';
  return null;
}
