import type { ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import { requiredIdsForDirectors, type DirectorSlotContext } from '@/lib/incorporation/incorp-director-slots';
import { isValidPre1Date } from '@/lib/checklist/checklist-pre1-validation';

const PRE7_STATUS_OPTIONS = new Set(['approved', 'corrections-requested']);

const PRE7_REQUIRED_TEXT_IDS = ['kycReviewStatus', 'kycReviewNotes'] as const;
/** DSC proof per director. The draft documents moved to the document pack (no upload here). */
const PRE7_REQUIRED_FILE_IDS = [
  'nrDirectorDscSuccessMessageUrl',
  'residentDirectorDscSuccessMessageUrl',
] as const;
/** The expiry of each new DSC, for the compliance calendar. */
const PRE7_REQUIRED_DATE_IDS = ['nrDirectorDscExpiryDate', 'residentDirectorDscExpiryDate'] as const;

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

  for (const id of requiredIdsForDirectors(PRE7_REQUIRED_DATE_IDS, slots)) {
    const value = (responses[id] ?? '').trim();
    if (!value) errors[id] = 'Enter the DSC expiry date.';
    else if (!isValidPre1Date(value)) errors[id] = 'Enter a valid date.';
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}
