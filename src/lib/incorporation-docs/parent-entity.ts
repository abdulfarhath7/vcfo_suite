import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import type { IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import {
  DEFAULT_PARENT_STATE,
  resolveParentCountry,
  resolveParentJurisdiction,
  resolveParentState,
} from '@/lib/parent-jurisdiction';
import { pickString } from '@/lib/incorporation-docs/shared';

const US_STATE_NAMES =
  /,\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/i;

export function resolveParentEntityName(
  pre1: ChecklistItemResponses,
  engagement?: IncorpMergeInput['engagement'],
): string {
  return pickString(pre1.parentEntityName, engagement?.parentEntityName, '[Parent entity name]');
}

export function resolveParentEntityAddress(
  pre1: ChecklistItemResponses,
  engagement?: IncorpMergeInput['engagement'],
): string {
  return pickString(
    pre1.parentEntityAddress,
    engagement?.parentEntityAddress,
    '[Parent entity address]',
  );
}

export function resolveParentEntityRegistration(
  pre1: ChecklistItemResponses,
  engagement?: IncorpMergeInput['engagement'],
): string {
  return pickString(
    pre1.parentEntityRegistrationNumber,
    engagement?.parentEntityRegistrationNumber,
    '[Registration number]',
  );
}

/**
 * State / province of incorporation: the Part A answer once the country is
 * answered (blank for a country without states); before that, a US state
 * named in the parent address, else Utah.
 */
export function resolveParentEntityState(
  pre1: ChecklistItemResponses,
  engagement?: IncorpMergeInput['engagement'],
): string {
  return resolveParentState(pre1, () => {
    const address = resolveParentEntityAddress(pre1, engagement);
    const stateOf = address.match(/\bState of\s+([^,]+)/i)?.[1]?.trim();
    if (stateOf) return stateOf;
    const match = address.match(US_STATE_NAMES);
    if (match?.[1]) return match[1];
    return DEFAULT_PARENT_STATE;
  });
}

/** Country: the Part A answer, else the parent address's last token, else "USA". */
export function resolveParentEntityCountry(
  pre1: ChecklistItemResponses,
  engagement?: IncorpMergeInput['engagement'],
): string {
  return resolveParentCountry(pre1, engagement);
}

/** "the United Kingdom" — used where no state precedes the country. */
export function resolveParentEntityJurisdiction(pre1: ChecklistItemResponses): string {
  return resolveParentJurisdiction(pre1);
}
