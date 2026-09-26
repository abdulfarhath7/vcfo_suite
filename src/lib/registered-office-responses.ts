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

/**
 * State / UT of the office (MOA clause II). Asked on pre-14 only — never on
 * the legacy Director KYC step, so it is not one of the shared ids above.
 */
export const REGISTERED_OFFICE_STATE_FIELD_ID = 'registeredOfficeState';

const RESOLVED_FIELD_IDS = [...REGISTERED_OFFICE_FIELD_IDS, REGISTERED_OFFICE_STATE_FIELD_ID] as const;

export const PRE6_REGISTERED_OFFICE_SECTION = 'Registered Office Details';

/** Where a pre-14 value was seeded from, stored beside the answers (not a rendered field). */
export const REGISTERED_OFFICE_SOURCE_FIELD_ID = 'registeredOfficeSource';
export const REGISTERED_OFFICE_SOURCE_LABEL: Record<string, string> = {
  'project-setup': 'Pre-filled from project setup',
  'director-kyc': 'Pre-filled from the earlier Director KYC step',
};

/**
 * Prefer the Registered Office step (pre-14, 2026-09-16); then the legacy
 * Director KYC step (pre-6); then the even older pre-8 storage — all the same
 * field ids. Callers with only the legacy maps still work.
 */
export function resolveRegisteredOfficeResponses(
  pre6: ChecklistItemResponses,
  pre8: ChecklistItemResponses = {},
  pre14: ChecklistItemResponses = {},
): ChecklistItemResponses {
  const merged: ChecklistItemResponses = {};
  for (const id of RESOLVED_FIELD_IDS) {
    const fromPre14 = (pre14[id] ?? '').trim();
    const fromPre6 = (pre6[id] ?? '').trim();
    const fromPre8 = (pre8[id] ?? '').trim();
    if (fromPre14) merged[id] = fromPre14;
    else if (fromPre6) merged[id] = fromPre6;
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
