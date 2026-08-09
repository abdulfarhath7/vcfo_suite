import { coerceStatusCode, type ChecklistItem, type StatusCode } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import {
  derivePreIncStepTone,
  type BoardResolutionProgressSnapshot,
  type ClientProgressTone,
} from '@/lib/client-progress-board';

const NONE_BR: BoardResolutionProgressSnapshot = { status: 'none', hasDraftDoc: false };

export function clientProgressToneToStatusCode(tone: ClientProgressTone): StatusCode {
  switch (tone) {
    case 'completed':
      return 'completed';
    case 'in-progress':
      return 'in-progress';
    case 'not-started':
    default:
      return 'not-started';
  }
}

/**
 * Effective checklist status for UI badges — merges DB slice status with board
 * resolution and milestone field progress (pre-2/pre-3 especially).
 */
export function deriveChecklistDisplayStatus(
  itemId: string,
  item: ChecklistItem,
  slice?: ChecklistItemStateSlice,
  boardResolution?: BoardResolutionProgressSnapshot,
): StatusCode {
  if (slice?.status === 'overdue') return 'overdue';

  if (item.bucket === 'pre-inc') {
    const checklistState = slice ? { [itemId]: slice } : {};
    const tone = derivePreIncStepTone(
      itemId,
      item,
      checklistState,
      boardResolution ?? NONE_BR,
    );
    const fromProgress = clientProgressToneToStatusCode(tone);
    if (slice?.status === 'awaiting-client' && fromProgress === 'not-started') {
      return 'awaiting-client';
    }
    return fromProgress;
  }

  return coerceStatusCode(slice?.status);
}
