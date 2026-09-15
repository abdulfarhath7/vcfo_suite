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
 * Second rule: the engagement started at Registration or Compliance
 * (`stage !== 'Pre-Incorporation'`) — it was incorporated before we met it.
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
  /**
   * Start stage. An engagement created at Registration or Compliance never
   * walks through Pre-12, so its stage — not step status — says it is
   * already incorporated.
   */
  stage?: string | null;
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
  if (engagement?.stage && engagement.stage !== 'Pre-Incorporation') return true;

  const coi = checklistState?.[CERTIFICATE_OF_INCORPORATION_STEP_ID];
  if (!coi) return false;
  return isChecklistStepSequentiallyComplete(coerceStatusCode(coi.status), coi);
}

/**
 * Lead-only gate: a project lead sees compliances only for incorporated
 * engagements, and the Compliances nav only while at least one exists.
 * Every other role keeps its full roster (with the pre-COI notice).
 */
export function complianceEngagementsForRole<T extends IncorporationEngagement & { id: string }>(
  role: string | null | undefined,
  engagements: readonly T[],
  stateFor: (engagement: T) => IncorporationChecklistState | undefined,
): T[] {
  if (role !== 'intern') return [...engagements];
  return engagements.filter((e) => isIncorporated(e, stateFor(e) ?? null));
}
