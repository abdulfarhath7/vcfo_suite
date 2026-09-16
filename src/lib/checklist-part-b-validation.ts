import { getItem } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { getClientResponseFields } from '@/lib/checklist-responses';
import { isValidPre1Date, isValidPre1Gender } from '@/lib/checklist-pre1-validation';
import {
  isRepeatField,
  missingRequiredEntryFields,
  repeatEntries,
  validateRepeatEntries,
  type RepeatField,
} from '@/lib/checklist-repeat';
import { hasIndiaResidentDirector, PROPOSED_DIRECTORS_GROUP_ID } from '@/lib/proposed-directors';

/**
 * Validators for the restructured SPICe+ Part B steps. Each takes the step's
 * responses and returns the same `{ ok, errors, warnings }` shape the older
 * per-step validators use, with repeat-entry errors keyed by concrete id.
 */
export interface StepValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function groupOf(itemId: string, groupId: string): RepeatField | null {
  const item = getItem(itemId);
  const field = item ? getClientResponseFields(item).find((f) => f.id === groupId) : undefined;
  return field && isRepeatField(field) ? field : null;
}

function result(errors: Record<string, string>, warnings: Record<string, string> = {}): StepValidationResult {
  return { ok: Object.keys(errors).length === 0, errors, warnings };
}

/** pre-15 Proposed directors: ≥ 2 entries, ≥ 1 resident in India, each entry complete. */
export function validatePre15Responses(responses: ChecklistItemResponses): StepValidationResult {
  const group = groupOf('pre-15', PROPOSED_DIRECTORS_GROUP_ID);
  if (!group) return result({});
  const errors = validateRepeatEntries(responses, group, (entry) => {
    const e = missingRequiredEntryFields(group, entry);
    const v = entry.values;
    if (v.gender?.trim() && !isValidPre1Gender(v.gender)) e.gender = 'Select a valid gender.';
    if (v.dob?.trim() && !isValidPre1Date(v.dob)) e.dob = 'Enter a valid date.';
    if (v.hasDsc === 'yes' && v.dscExpiryDate?.trim() && !isValidPre1Date(v.dscExpiryDate)) {
      e.dscExpiryDate = 'Enter a valid date.';
    }
    if (v.personalMailId?.trim() && !EMAIL_RE.test(v.personalMailId.trim())) {
      e.personalMailId = 'Enter a valid e-mail address.';
    }
    if (v.officialMailId?.trim() && !EMAIL_RE.test(v.officialMailId.trim())) {
      e.officialMailId = 'Enter a valid e-mail address.';
    }
    if (v.din?.trim() && !/^\d{8}$/.test(v.din.trim())) e.din = 'A DIN is 8 digits.';
    if (v.panNumber?.trim() && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(v.panNumber.trim())) {
      e.panNumber = 'PAN looks like ABCDE1234F.';
    }
    if (v.aadhaarNumber?.trim() && !/^\d{12}$/.test(v.aadhaarNumber.replace(/\s/g, ''))) {
      e.aadhaarNumber = 'Aadhaar is 12 digits.';
    }
    return e;
  });
  const entries = repeatEntries(responses, group);
  if (!errors[group.id] && entries.length >= (group.minEntries ?? 0) && !hasIndiaResidentDirector(entries)) {
    errors[group.id] = 'At least one proposed director must be a resident of India.';
  }
  return result(errors);
}
