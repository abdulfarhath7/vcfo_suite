import { periodAfterIncorporation } from '@/lib/compliance/generate-instances';
import {
  CERTIFICATE_OF_INCORPORATION_STEP_ID,
  isIncorporated,
  type IncorporationChecklistState,
} from '@/lib/compliance/incorporation-state';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';

/**
 * PRE-INCORPORATION FILINGS CLEANUP — which stored filings may be removed.
 *
 * A company has no statutory filings before it is incorporated. Before that rule was enforced,
 * the generator filled pre-incorporation companies with fixed-calendar filings (advance tax,
 * DIR-3 KYC, DPT-3, MSME-1) and could date a period before the incorporation day. The cleanup
 * script (`scripts/cleanup-pre-incorporation-filings.ts`) reads every stored filing with the
 * facts below and asks this module which ones go.
 *
 * A filing is BAD when its company is not incorporated (`isIncorporated`) or its period falls
 * before the incorporation day (`periodAfterIncorporation`). A bad filing is REMOVED only when
 * nobody has worked on it; one with any recorded work is kept and listed for a person to look at.
 * This module is pure: it reads no database and changes nothing.
 */

export type CleanupReason = 'not-incorporated' | 'before-incorporation';

export interface FilingCleanupRow {
  id: string;
  engagementId: string;
  companyName: string;
  particular: string;
  periodLabel: string | null;
  dueDate: string;
  periodEnd: string | null;
  status: string | null;
  filedOn: string | null;
  evidenceUrl: string | null;
  filedNote: string | null;
  windowFrom: string | null;
  windowTo: string | null;
  /** The engagement's facts that decide whether it is incorporated. */
  incorporationDate: string | null;
  stage: string | null;
  /** The Certificate of Incorporation step (pre-12) slice of the checklist state, if any. */
  coiStep: ChecklistItemStateSlice | null;
  /** compliance_instance_details. */
  acknowledgementNo: string | null;
  amountPaid: string | null;
  filedBy: string | null;
  dataReceivedOn: string | null;
  preparingSince: string | null;
  approvedOn: string | null;
  /** compliance_instance_workflow; a row that was never touched is absent or 'not-started'. */
  workflowStage: string | null;
  submittedAt: string | null;
  /**
   * Rows elsewhere that point at this filing: proofs, the filing thread, document requests,
   * client and SBC fields, checklist ticks, VCFO Assist runs, timed work and work checklists.
   */
  linkedCount: number;
}

/** Why a stored filing should not exist, or null when it is a real filing. */
export function filingCleanupReason(row: FilingCleanupRow): CleanupReason | null {
  const state: IncorporationChecklistState | null = row.coiStep
    ? { [CERTIFICATE_OF_INCORPORATION_STEP_ID]: row.coiStep }
    : null;
  if (!isIncorporated({ incorporationDate: row.incorporationDate, stage: row.stage }, state)) {
    return 'not-incorporated';
  }
  if (!periodAfterIncorporation(row, row.incorporationDate)) return 'before-incorporation';
  return null;
}

const present = (value: string | null | undefined) => Boolean(value && String(value).trim());

/** True when anyone recorded work on the filing, so it must not be deleted. */
export function filingHasRecordedWork(row: FilingCleanupRow): boolean {
  if (row.status === 'filed' || row.status === 'in-progress') return true;
  if (
    [
      row.filedOn,
      row.evidenceUrl,
      row.filedNote,
      row.windowFrom,
      row.windowTo,
      row.acknowledgementNo,
      row.filedBy,
      row.dataReceivedOn,
      row.preparingSince,
      row.approvedOn,
      row.submittedAt,
    ].some(present)
  ) {
    return true;
  }
  if (present(row.amountPaid) && Number(row.amountPaid) !== 0) return true;
  if (present(row.workflowStage) && row.workflowStage !== 'not-started') return true;
  return row.linkedCount > 0;
}

export interface CleanupSelection<T extends FilingCleanupRow> {
  /** Bad filings nobody worked on: safe to delete. */
  remove: Array<T & { reason: CleanupReason }>;
  /** Bad filings with recorded work: kept, for a person to review. */
  keep: Array<T & { reason: CleanupReason }>;
}

/** Splits the stored filings into the untouched bad ones (removed) and the worked bad ones (kept). */
export function selectPreIncorporationFilings<T extends FilingCleanupRow>(rows: readonly T[]): CleanupSelection<T> {
  const remove: CleanupSelection<T>['remove'] = [];
  const keep: CleanupSelection<T>['keep'] = [];
  for (const row of rows) {
    const reason = filingCleanupReason(row);
    if (!reason) continue;
    (filingHasRecordedWork(row) ? keep : remove).push({ ...row, reason });
  }
  return { remove, keep };
}
