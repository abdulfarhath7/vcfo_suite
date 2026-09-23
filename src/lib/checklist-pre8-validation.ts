import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { requiredIdsForDirectors, type DirectorSlotContext } from '@/lib/incorp-director-slots';

const PRE8_REQUIRED_FILE_IDS = [
  'nrDirectorPassportSignedUrl',
  'residentDirectorPassportSignedUrl',
  'nrDirectorDrivingLicenceSignedUrl',
  'residentDirectorDrivingLicenceSignedUrl',
  'nrDirectorUtilityBillSignedUrl',
  'residentDirectorUtilityBillSignedUrl',
  'nrDirectorDir2SignedUrl',
  'residentDirectorDir2SignedUrl',
  'nrDirectorDir8SignedUrl',
  'residentDirectorDir8SignedUrl',
  'nrDirectorInc9SignedUrl',
  'residentDirectorInc9SignedUrl',
  'authorisationLetterSignedUrl',
  'acceptanceLetterSignedUrl',
  'boardResolutionSignedForIncorpUrl',
  'moaSubscriptionSheetSignedUrl',
  'aoaSubscriptionSheetSignedUrl',
  'agileProSSignedUrl',
] as const;

export interface Pre8ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/** `slots` names the directors on file; without it the two legacy slots are required, as before. */
export function validatePre8Responses(
  responses: ChecklistItemResponses,
  slots?: DirectorSlotContext,
): Pre8ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  for (const id of requiredIdsForDirectors(PRE8_REQUIRED_FILE_IDS, slots)) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'Please upload a document.';
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}
