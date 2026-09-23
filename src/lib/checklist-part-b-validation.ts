import { getItem } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { getClientResponseFields } from '@/lib/checklist-responses';
import { isValidPre1Date, isValidPre1Gender } from '@/lib/checklist-pre1-validation';
import {
  applyShowWhen,
  isRepeatField,
  missingRequiredEntryFields,
  repeatEntries,
  validateRepeatEntries,
  type RepeatField,
} from '@/lib/checklist-repeat';
import { hasIndiaResidentDirector, PROPOSED_DIRECTORS_GROUP_ID } from '@/lib/proposed-directors';
import { isValidCinOrLlpin, PRE15_MAX_OTHER_INTERESTS } from '@/lib/other-company-interests';

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
    if (v.hasOtherCompanyInterest === 'yes') {
      for (let i = 1; i <= PRE15_MAX_OTHER_INTERESTS; i += 1) {
        const cin = v[`otherInterest${i}Cin`]?.trim();
        if (cin && !isValidCinOrLlpin(cin)) {
          e[`otherInterest${i}Cin`] = 'Enter a 21-character CIN or an LLPIN like AAA-0000.';
        }
        for (const part of ['From', 'To'] as const) {
          const date = v[`otherInterest${i}${part}`]?.trim();
          if (date && !isValidPre1Date(date)) e[`otherInterest${i}${part}`] = 'Enter a valid date.';
        }
      }
    }
    return e;
  });
  const entries = repeatEntries(responses, group);
  if (!errors[group.id] && entries.length >= (group.minEntries ?? 0) && !hasIndiaResidentDirector(entries)) {
    errors[group.id] = 'At least one proposed director must be a resident of India.';
  }
  return result(errors);
}

/** Required visible fields (honouring `showWhen`) that are still empty. */
function requiredFieldErrors(itemId: string, responses: ChecklistItemResponses): Record<string, string> {
  const item = getItem(itemId);
  if (!item) return {};
  const errors: Record<string, string> = {};
  for (const field of applyShowWhen(getClientResponseFields(item), responses)) {
    if (!field.required || field.type === 'repeat') continue;
    if (!(responses[field.id] ?? '').trim()) {
      errors[field.id] = field.type === 'file' ? 'Please upload a document.' : 'This field is required.';
    }
  }
  return errors;
}

const POSITIVE_INT_RE = /^\d+$/;
const POSITIVE_NUMBER_RE = /^\d+(\.\d{1,2})?$/;

/** Shares × nominal value, or '' when either side is missing / invalid. */
export function shareClassTotal(quantity: string | undefined, nominal: string | undefined): string {
  const q = (quantity ?? '').replace(/,/g, '').trim();
  const n = (nominal ?? '').replace(/,/g, '').trim();
  if (!POSITIVE_INT_RE.test(q) || !POSITIVE_NUMBER_RE.test(n)) return '';
  const total = Number(q) * Number(n);
  if (!Number.isFinite(total) || total <= 0) return '';
  return total.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** pre-13 Capital structure: at least one class; each chosen class has a positive quantity and nominal value. */
export function validatePre13Responses(responses: ChecklistItemResponses): StepValidationResult {
  const errors = requiredFieldErrors('pre-13', responses);
  const equity = (responses.equityShares ?? '').trim();
  const preference = (responses.preferenceShares ?? '').trim();
  if (equity !== 'yes' && preference !== 'yes' && equity && preference) {
    errors.equityShares = 'Select at least one share class — equity or preference.';
  }
  for (const cls of ['equity', 'preference'] as const) {
    if ((responses[`${cls}Shares`] ?? '').trim() !== 'yes') continue;
    const q = (responses[`${cls}Quantity`] ?? '').replace(/,/g, '').trim();
    const n = (responses[`${cls}NominalValue`] ?? '').replace(/,/g, '').trim();
    if (q && (!POSITIVE_INT_RE.test(q) || Number(q) <= 0)) errors[`${cls}Quantity`] = 'Enter a whole number of shares.';
    if (n && (!POSITIVE_NUMBER_RE.test(n) || Number(n) <= 0)) errors[`${cls}NominalValue`] = 'Enter the nominal value per share, e.g. 10.';
  }
  return result(errors);
}

/** pre-14 Registered office: address, NOC and utility-bill proof. */
export function validatePre14Responses(responses: ChecklistItemResponses): StepValidationResult {
  return result(requiredFieldErrors('pre-14', responses));
}

const CIN_RE = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
const LLPIN_RE = /^[A-Z]{3}-?\d{4}$/;

/** pre-16 Subscriber details: zero subscribers is a valid submit; each added one must be complete and well-formed. */
export function validatePre16Responses(responses: ChecklistItemResponses): StepValidationResult {
  const group = groupOf('pre-16', 'subscribers');
  if (!group) return result({});
  const errors = validateRepeatEntries(responses, group, (entry) => {
    const e = missingRequiredEntryFields(group, entry);
    const v = entry.values;
    if (v.entityType === 'body-corporate' && v.cin?.trim() && !CIN_RE.test(v.cin.trim().toUpperCase())) {
      e.cin = 'A CIN is 21 characters, e.g. U72900KA2026PTC123456.';
    }
    if (v.entityType === 'llp' && v.llpin?.trim() && !LLPIN_RE.test(v.llpin.trim().toUpperCase())) {
      e.llpin = 'An LLPIN looks like AAB-1234.';
    }
    if (v.shares?.trim() && (!POSITIVE_INT_RE.test(v.shares.replace(/,/g, '').trim()) || Number(v.shares.replace(/,/g, '')) <= 0)) {
      e.shares = 'Enter a whole number of shares.';
    }
    if (v.shareValue?.trim() && (!POSITIVE_NUMBER_RE.test(v.shareValue.replace(/,/g, '').trim()) || Number(v.shareValue.replace(/,/g, '')) <= 0)) {
      e.shareValue = 'Enter the value in INR, e.g. 100000.';
    }
    return e;
  });
  return result(errors);
}
