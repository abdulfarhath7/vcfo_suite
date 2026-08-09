import type { ChecklistItemResponses } from '@/lib/checklist-responses';

export interface Pre10ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validatePre10Responses(responses: ChecklistItemResponses): Pre10ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  if (!(responses.spicePartBAndAgileFiledNotes ?? '').trim()) {
    errors.spicePartBAndAgileFiledNotes = 'This field is required.';
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}
