import type { ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import { computeMcaNameApprovalExpiryDate } from '@/lib/checklist/checklist-responses';
import { nicBusinessType } from '@/lib/incorporation/nic-2008';
import { shareClassTotal } from '@/lib/checklist/checklist-part-b-validation';
import {
  clearPre6OtherCompanyInterestFields,
  getPre6OtherCompanyInterestCount,
} from '@/lib/checklist/checklist-pre6-validation';
import { additionalNicCodeEntryOf } from './helpers';

/**
 * The draft after one field changes: the new value plus every answer derived
 * from it (DSC follow-ups, other-company interests, NIC business types, share
 * class totals, name approval expiry) and the answers it clears.
 */
export function cascadeDraftFieldChange(
  itemId: string,
  prev: ChecklistItemResponses,
  fieldId: string,
  value: string,
): ChecklistItemResponses {
  const next: ChecklistItemResponses = { ...prev, [fieldId]: value };
  if (itemId === 'pre-6' && fieldId.endsWith('HasValidDsc')) {
    const prefix = fieldId.slice(0, -'HasValidDsc'.length);
    if (value !== 'yes') next[`${prefix}DscExpiryDate`] = '';
    if (value !== 'no') next[`${prefix}DscAvailabilitySlots`] = '';
  }
  if (itemId === 'pre-6' && fieldId.endsWith('HasOtherCompanyInterest')) {
    const prefix = fieldId.slice(0, -'HasOtherCompanyInterest'.length);
    if (value !== 'yes') {
      Object.assign(next, clearPre6OtherCompanyInterestFields(next, prefix));
    }
  }
  if (itemId === 'pre-6' && fieldId.endsWith('OtherCompanyInterestCount')) {
    const prefix = fieldId.slice(0, -'OtherCompanyInterestCount'.length);
    const keepCount = Number.parseInt(value, 10);
    if (Number.isFinite(keepCount) && keepCount >= 1) {
      Object.assign(
        next,
        clearPre6OtherCompanyInterestFields(next, prefix, { keepCount }),
      );
    }
  }
  if (fieldId === 'parentEntityHasTrademark' && value !== 'yes') {
    next.parentEntityTrademarkUrl = '';
  }
  if (itemId === 'pre-5' && fieldId === 'nameApprovalDate') {
    next.nameApprovalExpiryDate = computeMcaNameApprovalExpiryDate(value);
  }
  if (itemId === 'pre-1' && fieldId === 'nicCode') {
    next.nicBusinessType = nicBusinessType(value)?.description ?? '';
  }
  const extraNic = itemId === 'pre-1' ? additionalNicCodeEntryOf(fieldId) : null;
  if (extraNic && fieldId.endsWith('.code')) {
    next[`${extraNic}.businessType`] = nicBusinessType(value)?.description ?? '';
  }
  if (itemId === 'pre-16' && fieldId.endsWith('.type') && value === 'individual') {
    // Back to an individual: the entity-only answers no longer apply.
    const base = fieldId.slice(0, -'.type'.length);
    for (const key of ['entityType', 'cin', 'address', 'llpin', 'authorisedPerson']) next[`${base}.${key}`] = '';
  }
  if (itemId === 'pre-13') {
    for (const cls of ['equity', 'preference'] as const) {
      if (fieldId === `${cls}Quantity` || fieldId === `${cls}NominalValue` || fieldId === `${cls}Shares`) {
        next[`${cls}Total`] =
          next[`${cls}Shares`] === 'yes'
            ? shareClassTotal(next[`${cls}Quantity`], next[`${cls}NominalValue`])
            : '';
      }
    }
  }
  return next;
}

/** The explicit field errors after one field changes: its own and the ones it made moot. */
export function clearCascadedFieldErrors(
  itemId: string,
  prev: Record<string, string>,
  fieldId: string,
  value: string,
): Record<string, string> {
  const next = { ...prev };
  delete next[fieldId];
  if (itemId === 'pre-6' && fieldId.endsWith('HasValidDsc')) {
    const prefix = fieldId.slice(0, -'HasValidDsc'.length);
    if (value !== 'yes') delete next[`${prefix}DscExpiryDate`];
    if (value !== 'no') delete next[`${prefix}DscAvailabilitySlots`];
  }
  if (itemId === 'pre-6' && fieldId.endsWith('HasOtherCompanyInterest')) {
    const prefix = fieldId.slice(0, -'HasOtherCompanyInterest'.length);
    if (value !== 'yes') {
      for (const key of Object.keys(next)) {
        if (key.startsWith(prefix) && key.includes('OtherCompanyInterest')) {
          delete next[key];
        }
      }
    }
  }
  if (itemId === 'pre-6' && fieldId.endsWith('OtherCompanyInterestCount')) {
    const prefix = fieldId.slice(0, -'OtherCompanyInterestCount'.length);
    const keepCount = getPre6OtherCompanyInterestCount({ ...prev, [fieldId]: value }, prefix);
    for (let i = keepCount + 1; i <= 5; i += 1) {
      for (const part of ['Name', 'Shareholding', 'Designation', 'StartDate', 'EndDate']) {
        delete next[`${prefix}OtherCompanyInterest${i}${part}`];
      }
    }
  }
  if (fieldId === 'parentEntityHasTrademark' && value !== 'yes') {
    delete next.parentEntityTrademarkUrl;
  }
  return next;
}
