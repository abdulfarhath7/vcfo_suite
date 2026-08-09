import type { ChecklistItemResponses } from '@/lib/checklist-responses';

/** Complete address of proposed registered office (Pre-6 / P2S1). */
const REGISTERED_OFFICE_COMPLETE_ADDRESS_FIELD_ID = 'registeredOfficeCompleteAddress';

export const REGISTERED_OFFICE_FIELD_IDS = [
  REGISTERED_OFFICE_COMPLETE_ADDRESS_FIELD_ID,
  'registeredOfficeNocUrl',
  'registeredOfficeUtilityBillType',
  'registeredOfficeUtilityBillNumber',
  'registeredOfficeUtilityBillCopyUrl',
] as const;

export type RegisteredOfficeFieldId = (typeof REGISTERED_OFFICE_FIELD_IDS)[number];

export const PRE6_REGISTERED_OFFICE_SECTION = 'Registered Office Details';

/** Prefer Pre-6 values; fall back to legacy Pre-8 storage for the same field ids. */
export function resolveRegisteredOfficeResponses(
  pre6: ChecklistItemResponses,
  pre8: ChecklistItemResponses = {},
): ChecklistItemResponses {
  const merged: ChecklistItemResponses = {};
  for (const id of REGISTERED_OFFICE_FIELD_IDS) {
    const fromPre6 = (pre6[id] ?? '').trim();
    const fromPre8 = (pre8[id] ?? '').trim();
    if (fromPre6) merged[id] = fromPre6;
    else if (fromPre8) merged[id] = fromPre8;
  }
  return merged;
}

/** Seed empty Pre-6 registered office fields from legacy Pre-8 responses (same ids). */
export function mergeRegisteredOfficeIntoPre6(
  pre6Responses: ChecklistItemResponses,
  pre8Responses: ChecklistItemResponses = {},
): ChecklistItemResponses {
  const legacy = resolveRegisteredOfficeResponses({}, pre8Responses);
  const next = { ...pre6Responses };
  for (const id of REGISTERED_OFFICE_FIELD_IDS) {
    if ((next[id] ?? '').trim()) continue;
    const legacyVal = (legacy[id] ?? '').trim();
    if (legacyVal) next[id] = legacyVal;
  }
  return next;
}

export function registeredOfficeCompleteAddress(
  pre6: ChecklistItemResponses,
  pre8: ChecklistItemResponses = {},
): string {
  return (
    resolveRegisteredOfficeResponses(pre6, pre8)[REGISTERED_OFFICE_COMPLETE_ADDRESS_FIELD_ID] ?? ''
  ).trim();
}
