import type { ChecklistItemResponses } from '@/lib/checklist-responses';

const PRE7_STATUS_OPTIONS = new Set(['approved', 'corrections-requested']);

const PRE7_REQUIRED_TEXT_IDS = ['kycReviewStatus', 'kycReviewNotes'] as const;
const PRE7_REQUIRED_FILE_IDS = [
  'nrDirectorDscSuccessMessageUrl',
  'residentDirectorDscSuccessMessageUrl',
  'nrDirectorDir2DraftUrl',
  'residentDirectorDir2DraftUrl',
  'nrDirectorDir8DraftUrl',
  'residentDirectorDir8DraftUrl',
  'nrDirectorInc9DraftUrl',
  'residentDirectorInc9DraftUrl',
  'moaDraftUrl',
  'aoaDraftUrl',
  'authorisationLetterDraftUrl',
  'acceptanceLetterDraftUrl',
  'boardResolutionDraftForIncorpUrl',
  'moaSubscriptionSheetDraftUrl',
  'aoaSubscriptionSheetDraftUrl',
] as const;

export interface Pre7ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validatePre7Responses(responses: ChecklistItemResponses): Pre7ValidationResult {
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

  for (const id of PRE7_REQUIRED_FILE_IDS) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'Please upload a document.';
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}
