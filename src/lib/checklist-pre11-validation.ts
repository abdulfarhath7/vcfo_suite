import type { ChecklistItemResponses } from '@/lib/checklist-responses';

const PRE11_REQUIRED_TEXT_IDS = [
  'mcaRemarksSummary',
  'clientInformationRequested',
  'resubmissionNotes',
] as const;

const PRE11_REQUIRED_FILE_IDS = ['clarificationLetterUrl'] as const;

export interface Pre11ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validatePre11Responses(responses: ChecklistItemResponses): Pre11ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  for (const id of PRE11_REQUIRED_TEXT_IDS) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'This field is required.';
    }
  }

  for (const id of PRE11_REQUIRED_FILE_IDS) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'Please upload a document.';
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}
