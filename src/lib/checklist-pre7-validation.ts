import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { requiredIdsForDirectors, type DirectorSlotContext } from '@/lib/incorp-director-slots';

const PRE7_STATUS_OPTIONS = new Set(['approved', 'corrections-requested']);

const PRE7_REQUIRED_TEXT_IDS = ['kycReviewStatus', 'kycReviewNotes'] as const;
/** DSC proof per director. The draft documents moved to the document pack (no upload here). */
const PRE7_REQUIRED_FILE_IDS = [
  'nrDirectorDscSuccessMessageUrl',
  'residentDirectorDscSuccessMessageUrl',
] as const;

export interface Pre7ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/** `slots` names the directors on file; without it the two legacy slots are required, as before. */
export function validatePre7Responses(
  responses: ChecklistItemResponses,
  slots?: DirectorSlotContext,
): Pre7ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  for (const id of PRE7_REQUIRED_TEXT_IDS) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'This field is required.';
    }
  }

  if (
    (responses.kycReviewStatus ?? '').trim() &&
    !PRE7_STATUS_OPTIONS.has((responses.kycReviewStatus ?? '').trim())
  ) {
    errors.kycReviewStatus = 'Select a valid review status.';
  }

  for (const id of requiredIdsForDirectors(PRE7_REQUIRED_FILE_IDS, slots)) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'Please upload a document.';
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}
