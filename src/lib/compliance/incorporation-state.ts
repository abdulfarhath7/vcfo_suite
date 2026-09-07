import { coerceStatusCode } from '@/data/checklist';
import { isChecklistStepSequentiallyComplete } from '@/lib/checklist-step-gate';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

/**
 * INCORPORATION STATE — the one read-only answer to "is this company
 * incorporated yet?".
 *
 * Every surface that shows or hides post-COI content (the compliance calendar,
 * the filings register, the super admin's project rail) asks this helper and
 * nothing else, so they can never disagree about the same engagement.
 *
 * Primary rule: `engagements.incorporation_date` is set. That is the column the
 * Inngest compliance job generates from, so "incorporated" here means exactly
 * "instances can exist".
 *
 * Fallback, for a payload that lacks the date: the Certificate of Incorporation
 * step (Pre-12) is terminal in the checklist state, read through the existing
 * sequencing rule (`isChecklistStepSequentiallyComplete`) rather than a second
 * copy of the gate logic.
 *
 * This module only reads. The date is written by the Pre-12 sync and the
 * engagement PATCH route; neither is touched from here.
 */

/** Pre-12 — "Certificate of Incorporation" in `src/data/checklist.ts`. */
export const CERTIFICATE_OF_INCORPORATION_STEP_ID = 'pre-12';

export type IncorporationEngagement = {
  incorporationDate?: string | null;
};

export type IncorporationChecklistState = Record<
  string,
  ChecklistItemStateSlice | undefined
>;

export function isIncorporated(
  engagement: IncorporationEngagement | null | undefined,
  checklistState?: IncorporationChecklistState | null,
): boolean {
  if (engagement?.incorporationDate?.trim()) return true;

  const coi = checklistState?.[CERTIFICATE_OF_INCORPORATION_STEP_ID];
  if (!coi) return false;
  return isChecklistStepSequentiallyComplete(coerceStatusCode(coi.status), coi);
}
