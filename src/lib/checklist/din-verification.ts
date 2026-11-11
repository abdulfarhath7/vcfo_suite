import { parseRepeatFieldId, repeatFieldId } from '@/lib/checklist/checklist-repeat';

/**
 * DR-01: the DIN check on each proposed director. MCA has no public API, so the project lead
 * checks the DIN against the MCA director master data by hand and records the result here
 * (the change list's proposal). The status lives in the entry's own answers, so a paid lookup
 * API can later fill the same keys.
 */

/** The repeat group of Proposed directors (pre-15). */
export const DIN_GROUP_ID = 'directors';

export const DIN_STATUS_OPTIONS = [
  { value: 'verified', label: 'Verified' },
  { value: 'mismatch', label: 'Mismatch' },
  { value: 'not-found', label: 'Not found' },
] as const;

/** Entry answers only the project lead writes. */
export const DIN_LEAD_ONLY_ENTRY_FIELD_IDS: readonly string[] = ['dinStatus', 'dinMismatchNote', 'dinProofUrl'];

/** Stamps the server writes beside the status: who checked and when. Never typed by anyone. */
export const DIN_STAMP_FIELD_IDS: readonly string[] = ['dinCheckedBy', 'dinCheckedAt'];

export type DinVerification =
  | { kind: 'verified' | 'mismatch' | 'not-found'; note?: string; by?: string; at?: string }
  | { kind: 'to-apply' }
  | { kind: 'unchecked' };

/** The badge state of one director entry. */
export function dinVerificationOf(responses: Record<string, string | undefined>, entryId: string): DinVerification {
  const get = (field: string) => (responses[repeatFieldId(DIN_GROUP_ID, entryId, field)] ?? '').trim();
  if (get('hasDin') === 'no') return { kind: 'to-apply' };
  const status = get('dinStatus');
  if (status === 'verified' || status === 'mismatch' || status === 'not-found') {
    return {
      kind: status,
      note: get('dinMismatchNote') || undefined,
      by: get('dinCheckedBy') || undefined,
      at: get('dinCheckedAt') || undefined,
    };
  }
  return { kind: 'unchecked' };
}

export const DIN_BADGE_LABEL: Record<DinVerification['kind'], string> = {
  verified: 'DIN verified',
  mismatch: 'DIN mismatch',
  'not-found': 'DIN not found',
  'to-apply': 'DIN to be applied in SPICe+',
  unchecked: 'DIN not checked yet',
};

/**
 * Applied to every save of the step: drops any stamp a browser sent, then stamps the actor and
 * the time on each entry whose DIN status this save changes.
 */
export function stampDinChecks(
  prev: Record<string, string | undefined>,
  patch: Record<string, string>,
  actorName: string | null | undefined,
  now: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(patch)) {
    const parsed = parseRepeatFieldId(key);
    if (parsed?.groupId === DIN_GROUP_ID && DIN_STAMP_FIELD_IDS.includes(parsed.fieldId)) continue;
    out[key] = value;
  }
  for (const [key, value] of Object.entries(out)) {
    const parsed = parseRepeatFieldId(key);
    if (parsed?.groupId !== DIN_GROUP_ID || parsed.fieldId !== 'dinStatus') continue;
    if ((prev[key] ?? '') === value) continue;
    out[repeatFieldId(DIN_GROUP_ID, parsed.entryId, 'dinCheckedBy')] = value ? actorName?.trim() || 'Project lead' : '';
    out[repeatFieldId(DIN_GROUP_ID, parsed.entryId, 'dinCheckedAt')] = value ? now : '';
  }
  return out;
}
