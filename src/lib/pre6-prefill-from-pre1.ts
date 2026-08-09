import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import { getPre6DirectorSlotsFromPre1 } from '@/lib/checklist-pre6-validation';

const PRE6_PREFILL_SUFFIXES = ['FirstName', 'MiddleName', 'LastName', 'Gender'] as const;

function isEmptyResponseValue(value: string | undefined | null): boolean {
  return !(value ?? '').trim();
}

/**
 * Seed empty Pre-6 director name/gender fields from Phase 1 Step 1 proposed directors.
 * Residential status is implied by NR vs resident section; does not copy a separate field.
 * Never overwrites non-empty Pre-6 values (saved or in-progress edits).
 */
export function applyPre6PrefillFromPre1(
  pre6Responses: ChecklistItemResponses,
  pre1Responses: ChecklistItemResponses,
): ChecklistItemResponses {
  const slots = getPre6DirectorSlotsFromPre1(pre1Responses);
  if (!slots.length) return pre6Responses;

  const next = { ...pre6Responses };

  for (const slot of slots) {
    const i = slot.pre1DirectorIndex;
    const prefix = slot.prefix;

    for (const suffix of PRE6_PREFILL_SUFFIXES) {
      const pre6Key = `${prefix}${suffix}`;
      if (!isEmptyResponseValue(next[pre6Key])) continue;

      const pre1Key = `director${i}${suffix}`;
      const pre1Val = (pre1Responses[pre1Key] ?? '').trim();
      if (pre1Val) next[pre6Key] = pre1Val;
    }

    const firstKey = `${prefix}FirstName`;
    const lastKey = `${prefix}LastName`;
    if (
      isEmptyResponseValue(next[firstKey]) &&
      isEmptyResponseValue(next[lastKey]) &&
      isEmptyResponseValue(next[`${prefix}FullName`])
    ) {
      const legacyName = (pre1Responses[`director${i}Name`] ?? '').trim();
      if (legacyName) next[firstKey] = legacyName;
    }
  }

  return next;
}
