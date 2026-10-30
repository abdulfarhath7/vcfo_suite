import {
  BOARD_RESOLUTION_MERGE_FIELD_KEYS,
  type BoardResolutionMergeFields,
} from '@/lib/board-resolution/board-resolution';

/**
 * The values that feed the board resolution (NOC) draft, as a flat snapshot, for the
 * out-of-date mark (T3) and Compare versions (T4). Pure.
 */

export const NOC_FIELD_LABEL: Record<(typeof BOARD_RESOLUTION_MERGE_FIELD_KEYS)[number], string> = {
  PARENT_ENTITY_NAME: 'Parent name',
  PARENT_ENTITY_ADDRESS: 'Parent address',
  RESOLUTION_EFFECTIVE_DATE: 'Meeting date',
  PARENT_JURISDICTION: 'Parent jurisdiction',
  PARENT_STATE: 'Parent state',
  PROPOSED_NAME_1: 'Proposed name 1',
  PROPOSED_NAME_2: 'Proposed name 2',
  PROPOSED_NAMES: 'Proposed names',
  NIC_CODES: 'NIC codes',
  AUTHORISED_CAPITAL: 'Authorised capital',
  PAID_UP_CAPITAL: 'Paid-up capital',
  INDIAN_DIRECTOR_LINE: 'Indian director',
  SECOND_DIRECTOR_LINE: 'Other directors',
  DIRECTOR_NAMES: 'Directors',
  SIGNATORY_NAME: 'Who signs',
  SIGNATORY_DESIGNATION: 'Designation',
  CERTIFICATION_DATE: 'Certified date',
  CERTIFICATION_PLACE: 'Certified place',
  RESOLUTION_DAY: 'Meeting day',
  NAME_WORD: 'Name word',
  SIGNATORY_DIN: 'Signer DIN',
};

/** The key a snapshot uses for the template variant, so a template change shows in a compare. */
export const NOC_VARIANT_FIELD = '__variant';

/** Dates that fall back to "today" when Pre-1 has no resolution date; comparing them would mark every draft out of date. */
const TODAY_FALLBACK_KEYS = new Set(['RESOLUTION_EFFECTIVE_DATE', 'CERTIFICATION_DATE', 'RESOLUTION_DAY']);

/**
 * The snapshot stored with each version: every merge value, plus the variant. When Pre-1 holds
 * no resolution date the three date values are dropped, because the generator fills them with
 * the current day.
 */
export function nocSnapshotFields(
  fields: BoardResolutionMergeFields,
  variant: string,
  hasResolutionDate: boolean,
): Record<string, string> {
  const out: Record<string, string> = { [NOC_VARIANT_FIELD]: variant };
  for (const key of BOARD_RESOLUTION_MERGE_FIELD_KEYS) {
    if (!hasResolutionDate && TODAY_FALLBACK_KEYS.has(key)) continue;
    out[key] = String(fields[key] ?? '');
  }
  return out;
}

export interface NocFieldChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

function labelFor(key: string): string {
  if (key === NOC_VARIANT_FIELD) return 'Template';
  return (NOC_FIELD_LABEL as Record<string, string>)[key] ?? key;
}

/**
 * The values that differ between two snapshots, in merge-key order. A key missing on one side
 * (a date dropped because no date was given) is not a change.
 */
export function diffNocFields(
  before: Readonly<Record<string, string>> | null | undefined,
  after: Readonly<Record<string, string>> | null | undefined,
): NocFieldChange[] {
  if (!before || !after) return [];
  const keys = [NOC_VARIANT_FIELD, ...BOARD_RESOLUTION_MERGE_FIELD_KEYS];
  const out: NocFieldChange[] = [];
  for (const key of keys) {
    if (!(key in before) || !(key in after)) continue;
    const a = String(before[key] ?? '');
    const b = String(after[key] ?? '');
    if (a !== b) out.push({ key, label: labelFor(key), before: a, after: b });
  }
  return out;
}
