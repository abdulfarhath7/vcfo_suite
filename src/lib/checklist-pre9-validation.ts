import type { ChecklistItemResponses } from '@/lib/checklist-responses';

const PRE9_CONFIRMATION_OPTIONS = new Set(['confirmed', 'changes-recommended']);

export interface Pre9ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validatePre9Responses(responses: ChecklistItemResponses): Pre9ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  if (!(responses.spicePartBApplicationReview ?? '').trim()) {
    errors.spicePartBApplicationReview = 'This field is required.';
  }

  const confirmation = (responses.spicePartBConfirmation ?? '').trim();
  if (!confirmation) {
    errors.spicePartBConfirmation = 'This field is required.';
  } else if (!PRE9_CONFIRMATION_OPTIONS.has(confirmation)) {
    errors.spicePartBConfirmation = 'Select a valid confirmation option.';
  }

  if (
    confirmation === 'changes-recommended' &&
    !(responses.spicePartBRecommendedChanges ?? '').trim()
  ) {
    errors.spicePartBRecommendedChanges = 'Describe the recommended changes.';
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}
