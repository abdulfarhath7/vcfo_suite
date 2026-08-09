import type { ChecklistItemResponses } from '@/lib/checklist-responses';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PRE12_YES_NO_VALUES = new Set(['yes', 'no']);

const PRE12_REQUIRED_TEXT_IDS = [
  'incorporatedCompanyName',
  'dateOfIncorporation',
  'cin',
  'pan',
  'tan',
  'pfCode',
  'esiCode',
  'coiSignatureVerifiedByMca',
] as const;

const PRE12_REQUIRED_FILE_IDS = [
  'certificateOfIncorporationFinalUrl',
  'panCardFinalUrl',
  'tanCardFinalUrl',
] as const;

function isValidIsoDate(value: string | undefined | null): boolean {
  const v = (value ?? '').trim();
  if (!ISO_DATE_RE.test(v)) return false;
  const [year, month, day] = v.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export interface Pre12ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validatePre12Responses(responses: ChecklistItemResponses): Pre12ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  for (const id of PRE12_REQUIRED_TEXT_IDS) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'This field is required.';
    }
  }

  if (
    (responses.dateOfIncorporation ?? '').trim() &&
    !isValidIsoDate(responses.dateOfIncorporation)
  ) {
    errors.dateOfIncorporation = 'Enter a valid date.';
  }

  const coiVerified = (responses.coiSignatureVerifiedByMca ?? '').trim();
  if (coiVerified && !PRE12_YES_NO_VALUES.has(coiVerified)) {
    errors.coiSignatureVerifiedByMca = 'Select Yes or No.';
  }

  for (const id of PRE12_REQUIRED_FILE_IDS) {
    if (!(responses[id] ?? '').trim()) {
      errors[id] = 'Please upload a document.';
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings };
}
