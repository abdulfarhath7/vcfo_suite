import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

export interface ChecklistSubmissionMeta {
  clientSubmittedAt?: string;
  locked?: boolean;
  unlockedFields?: string[];
}

type SliceLike = ChecklistSubmissionMeta | ChecklistItemStateSlice | null | undefined;

export function getSubmissionMeta(slice: SliceLike): ChecklistSubmissionMeta {
  if (!slice || typeof slice !== 'object') return {};
  return {
    clientSubmittedAt:
      typeof slice.clientSubmittedAt === 'string' ? slice.clientSubmittedAt : undefined,
    locked: slice.locked === true,
    unlockedFields: Array.isArray(slice.unlockedFields)
      ? slice.unlockedFields.filter((id): id is string => typeof id === 'string')
      : undefined,
  };
}

export function isClientSubmissionLocked(slice: SliceLike): boolean {
  const { locked, clientSubmittedAt } = getSubmissionMeta(slice);
  return locked === true && Boolean(clientSubmittedAt);
}

export function isFieldEditableForClient(slice: SliceLike, fieldId: string): boolean {
  if (!isClientSubmissionLocked(slice)) return true;
  const { unlockedFields = [] } = getSubmissionMeta(slice);
  return unlockedFields.includes(fieldId);
}

/** @deprecated Prefer getClientReviewBanner from checklist-item-review */
/** When false (intern/manager), all fields in partial may be saved even after client submit. */
export function filterResponsesToEditableFields(
  slice: SliceLike,
  partial: Record<string, string>,
  enforceClientLock = true,
): Record<string, string> {
  if (!enforceClientLock || !isClientSubmissionLocked(slice)) return partial;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(partial)) {
    if (isFieldEditableForClient(slice, key)) out[key] = value;
  }
  return out;
}
