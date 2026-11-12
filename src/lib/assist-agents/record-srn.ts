import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { checklistStateFromRow, getEngagementById } from '@/db/repositories/engagements';
import { applyChecklistPatch } from '@/lib/incorporation/apply-checklist-patch';
import { findSubAgent } from './catalog';

/**
 * SRN WRITE-BACK — a finished run's SRN goes onto its checklist step through the ordinary staff
 * save (`applyChecklistPatch`, the path the checklist autosave and Ask VCFO use), so the same role
 * rules apply and the save is audited.
 *
 * SA-01: the SRN goes into the step's "Acknowledgement number (SRN)" field (`srnField`, which is
 * `acknowledgementNumber`), the one field the step card, the exports and the MCA filing card read.
 * The run fills an empty field and never replaces a different number the lead typed; it changes
 * no status, review or lock field. A responses-only patch sends no email. A task without an
 * `srnField` keeps its SRN on the run only.
 */

/** Write the SRN into an empty field; keep a field that already holds this SRN or another one. */
export function srnToWrite(existing: string | undefined, srn: string): { write: string } | { keep: 'same' | 'differs' } {
  const current = (existing ?? '').trim();
  if (!current) return { write: srn };
  return current.toUpperCase() === srn.trim().toUpperCase() ? { keep: 'same' } : { keep: 'differs' };
}

export type SrnWriteBack = { recorded: true; stepId: string; field: string } | { recorded: false; reason: string };

/**
 * `engagementDbId` is the engagement's uuid as the run repository resolved it, never the URL
 * segment: a slug in the URL is not a uuid, and Postgres would refuse the lookup.
 */
export async function recordRunSrn(
  ctx: AuthContext,
  engagementDbId: string,
  subAgentId: string,
  srn: string,
): Promise<SrnWriteBack> {
  const sub = findSubAgent(subAgentId);
  if (!sub?.stepId || !sub.srnField) return { recorded: false, reason: 'no_step_field' };
  try {
    const row = await getEngagementById(ctx, engagementDbId);
    if (!row) return { recorded: false, reason: 'not_found' };
    const current = checklistStateFromRow(row)[sub.stepId]?.responses?.[sub.srnField];
    const plan = srnToWrite(typeof current === 'string' ? current : undefined, srn);
    if ('keep' in plan) {
      // The lead typed another number: the run keeps its SRN and the lead decides.
      return plan.keep === 'same' ? { recorded: true, stepId: sub.stepId, field: sub.srnField } : { recorded: false, reason: 'srn_differs' };
    }
    await applyChecklistPatch(ctx, engagementDbId, sub.stepId, { responses: { [sub.srnField]: plan.write } });
    return { recorded: true, stepId: sub.stepId, field: sub.srnField };
  } catch (error) {
    // The run keeps the SRN either way; a refused save (a locked step) is reported, not thrown.
    console.warn('[assist-agents] SRN not written to the checklist', error);
    return { recorded: false, reason: 'checklist_refused' };
  }
}
