import type { DeliveryStatus } from '@/lib/notify/types';

/**
 * Delivery status only moves forward: queued → sent → delivered → read, and
 * failed is final. SNS delivers late and duplicate events, so a `delivered`
 * arriving after `read` must not move the row back. `skipped` rows never had a
 * provider id and are final too.
 */
const RANK: Partial<Record<DeliveryStatus, number>> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

const FINAL = new Set<DeliveryStatus>(['failed', 'skipped']);

export function canAdvanceDeliveryStatus(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (FINAL.has(from)) return false;
  const fromRank = RANK[from];
  const toRank = RANK[to];
  if (fromRank === undefined || toRank === undefined) return false;
  return toRank > fromRank;
}

/** Current statuses a row may hold for an update to `to` to apply. */
export function statusesThatMayAdvanceTo(to: DeliveryStatus): DeliveryStatus[] {
  return (Object.keys(RANK) as DeliveryStatus[]).filter((from) => canAdvanceDeliveryStatus(from, to));
}
