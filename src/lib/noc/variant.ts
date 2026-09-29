import {
  coerceOwnershipType,
  coerceParentIndianRelationship,
} from '@/data/engagements';

/** Which parent NOC a group company needs. Standalone companies need none. */
export type NocVariant = 'foreign-parent' | 'indian-name-only' | 'indian-investing';

export const NOC_VARIANTS: readonly NocVariant[] = [
  'foreign-parent',
  'indian-name-only',
  'indian-investing',
];

/**
 * Pure: decides the NOC from the ownership answers on the project. Returns null
 * for a standalone company, and for an Indian parent whose role is not chosen
 * yet — the caller treats that as "incomplete", not "no NOC".
 */
export function resolveNocVariant(e: {
  ownershipType?: string | null;
  companyType?: string | null;
  parentIndianRelationship?: string | null;
}): NocVariant | null {
  if (coerceOwnershipType(e.ownershipType) === 'independent') return null;
  if (e.companyType === 'foreign') return 'foreign-parent';
  if (e.companyType !== 'domestic') return null;
  switch (coerceParentIndianRelationship(e.parentIndianRelationship)) {
    case 'name_only':
      return 'indian-name-only';
    case 'investing':
      return 'indian-investing';
    default:
      return null;
  }
}
