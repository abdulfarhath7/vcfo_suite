import 'server-only';

import type { Engagement } from '@/data/engagements';
import { directorResponsesFromState } from '@/lib/proposed-directors';
import type { BoardResolutionMergeFields } from '@/lib/board-resolution';
import {
  BoardResolutionError,
  BOARD_RESOLUTION_ERROR_CODES,
  toBoardResolutionError,
  validateBoardResolutionGeneration,
} from '@/lib/api/board-resolution-errors';
import type { EngagementChecklistState } from '@/db/repositories/engagements';
import {
  generateBoardResolutionArtifacts,
  getBoardResolutionTemplateFingerprint,
  sanitizeBoardResolutionDocxBuffer,
} from '@/lib/board-resolution-docx';
import {
  downloadBoardResolutionDocx,
  uploadBoardResolutionDocx,
} from '@/storage/board-resolution';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

export async function generateAndStoreBoardResolution(
  engagement: Engagement,
  checklistState: EngagementChecklistState | null | undefined,
  options?: {
    overrides?: Partial<BoardResolutionMergeFields>;
    /** Preview plain text — patches existing docx when storage path is set. */
    content?: string;
    existingStoragePath?: string | null;
    /** When patching only, keep the stored template fingerprint unchanged. */
    preserveTemplateFingerprint?: string | null;
    /** Re-render from the on-disk template instead of patching the stored docx. */
    forceTemplateRefresh?: boolean;
    isFinalized?: boolean;
    /** Allow rebuilding storage while status stays finalized (corrupt file repair). */
    allowFinalizedRepair?: boolean;
  },
): Promise<{ content: string; storagePath: string; templateFingerprint: string | null }> {
  const pre1State = checklistState?.['pre-1'] as ChecklistItemStateSlice | undefined;
  // Part A answers with the proposed directors overlaid from `pre-15`
  // (legacy slots on `pre-1` for older engagements).
  const { pre1 } = directorResponsesFromState(checklistState);

  const forceTemplateRefresh = options?.forceTemplateRefresh === true;
  const editedContent = forceTemplateRefresh ? undefined : options?.content?.trim();
  let existingDocx: Buffer | undefined;
  let isPatchOnly = false;

  if (editedContent && options?.existingStoragePath?.trim()) {
    validateBoardResolutionGeneration({
      pre1,
      pre1State,
      engagement,
      isPatchOnly: true,
      isFinalized: options?.isFinalized,
      allowFinalizedRepair: options?.allowFinalizedRepair,
    });

    const downloaded = await downloadBoardResolutionDocx(options.existingStoragePath);
    if (!downloaded) {
      throw new BoardResolutionError(
        'The saved Word file could not be loaded. Re-generate from Pre-1, then try saving again.',
        BOARD_RESOLUTION_ERROR_CODES.EXISTING_DOC_MISSING,
      );
    }

    existingDocx = sanitizeBoardResolutionDocxBuffer(Buffer.from(downloaded));
    isPatchOnly = true;
  } else {
    validateBoardResolutionGeneration({
      pre1,
      pre1State,
      engagement,
      isPatchOnly: false,
      isFinalized: options?.isFinalized,
      allowFinalizedRepair: options?.allowFinalizedRepair,
    });
  }

  let content: string;
  let docx: Buffer;
  try {
    const artifacts = generateBoardResolutionArtifacts(
      { engagement, pre1, overrides: options?.overrides },
      { content: editedContent, existingDocx },
    );
    content = artifacts.content;
    docx = artifacts.docx;
  } catch (err) {
    if (err instanceof BoardResolutionError) throw err;
    throw toBoardResolutionError(err);
  }

  let storagePath: string;
  try {
    storagePath = await uploadBoardResolutionDocx(engagement.id, docx);
  } catch {
    throw new BoardResolutionError(
      'Could not upload the board resolution file. Try again in a moment.',
      BOARD_RESOLUTION_ERROR_CODES.STORAGE_UPLOAD_FAILED,
    );
  }

  const templateFingerprint = isPatchOnly
    ? options?.preserveTemplateFingerprint?.trim() || null
    : getBoardResolutionTemplateFingerprint();

  return { content, storagePath, templateFingerprint };
}
