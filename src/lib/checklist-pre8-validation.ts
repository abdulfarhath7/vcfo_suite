import type { ChecklistItemResponses } from '@/lib/checklist-responses';

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
  'certificateOfIncorporationSignedUrl',
  'authorisationLetterSignedUrl',
  'acceptanceLetterSignedUrl',
  'boardResolutionSignedForIncorpUrl',
  'moaSubscriptionSheetSignedUrl',
  'aoaSubscriptionSheetSignedUrl',
] as const;

export interface Pre8ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validatePre8Responses(responses: ChecklistItemResponses): Pre8ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  for (const id of PRE8_REQUIRED_FILE_IDS) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'Please upload a document.';
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}
