import { computeMcaNameApprovalExpiryDate } from '@/lib/checklist/checklist-responses';

/**
 * SA-02: the name approval expiry date (pre-5) is calculated from the approval date, and the
 * project lead, a manager or an admin may change it. The client reads it and may not change it.
 *
 * The one write a client save may carry is the calculated date itself: the form recalculates the
 * expiry when the approval date changes, and a submit fills an empty expiry, but only while the
 * stored expiry is still the calculated one (`field-cascade.ts` follows the same rule). A date that
 * staff set by hand is never replaced from a client save.
 */
export const NAME_APPROVAL_STEP_ID = 'pre-5';
export const NAME_APPROVAL_EXPIRY_FIELD_ID = 'nameApprovalExpiryDate';

export const NAME_EXPIRY_CLIENT_REFUSED = 'Only your project lead, manager or admin can change the name approval expiry date.';

/** True when a client save would change the expiry date to anything but the calculated date. */
export function clientChangesNameExpiry(
  itemId: string,
  sent: Record<string, string> | null | undefined,
  stored: Record<string, string> | null | undefined,
): boolean {
  if (itemId !== NAME_APPROVAL_STEP_ID || !sent || !(NAME_APPROVAL_EXPIRY_FIELD_ID in sent)) return false;
  const before = (stored?.[NAME_APPROVAL_EXPIRY_FIELD_ID] ?? '').trim();
  const next = (sent[NAME_APPROVAL_EXPIRY_FIELD_ID] ?? '').trim();
  if (next === before) return false;
  const storedApproval = stored?.nameApprovalDate ?? '';
  const wasCalculated = !before || before === computeMcaNameApprovalExpiryDate(storedApproval);
  const approval = sent.nameApprovalDate ?? storedApproval;
  return !(wasCalculated && next !== '' && next === computeMcaNameApprovalExpiryDate(approval));
}
