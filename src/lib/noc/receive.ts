import {
  coerceOwnershipType,
  coerceParentIndianRelationship,
} from '@/data/engagements';
import { resolveNocVariant, type NocVariant } from '@/lib/noc/variant';

/**
 * The board resolution (NOC) track, receive checklist and decision path (R-52). Pure, so the
 * client page, the staff page, the repository and the tests read one answer.
 */

export type NocStepKey = 'drafted' | 'released' | 'signed' | 'notarised' | 'apostilled' | 'accepted';

export const NOC_STEP_LABEL: Record<NocStepKey, string> = {
  drafted: 'Drafted',
  released: 'Released',
  signed: 'Signed',
  notarised: 'Notarised',
  apostilled: 'Apostilled',
  accepted: 'Accepted',
};

/** True for the variant whose resolution a notary and an apostille must certify (D1). */
export function isForeignVariant(variant: NocVariant | null | undefined): boolean {
  return variant === 'foreign-parent';
}

/** The steps in order: six for a foreign parent, four for an Indian parent or when SBC turned the notary steps off. */
export function nocTrackKeys(foreign: boolean, notaryStepsOff = false): NocStepKey[] {
  return foreign && !notaryStepsOff
    ? ['drafted', 'released', 'signed', 'notarised', 'apostilled', 'accepted']
    : ['drafted', 'released', 'signed', 'accepted'];
}

export type NocCheckKey =
  | 'director_signature'
  | 'date_place'
  | 'letterhead'
  | 'notary_stamp'
  | 'apostille'
  | 'names_match';

export interface NocCheckDef {
  key: NocCheckKey;
  label: string;
  /** Only for a foreign parent with the notary steps on. */
  notary?: boolean;
}

const ALL_CHECKS: readonly NocCheckDef[] = [
  { key: 'director_signature', label: 'Signature of a parent director' },
  { key: 'date_place', label: 'Date and place filled' },
  { key: 'letterhead', label: "On the parent's letterhead" },
  { key: 'notary_stamp', label: 'Notary stamp', notary: true },
  { key: 'apostille', label: 'Apostille certificate', notary: true },
  { key: 'names_match', label: 'Names match the draft' },
];

/** T5: six checks for a foreign parent, four for an Indian parent. */
export function nocReceiveChecks(foreign: boolean, notaryStepsOff = false): NocCheckDef[] {
  const notary = foreign && !notaryStepsOff;
  return ALL_CHECKS.filter((c) => notary || !c.notary);
}

export function isNocCheckKey(key: string): key is NocCheckKey {
  return ALL_CHECKS.some((c) => c.key === key);
}

/** The step a check also stamps: the notary stamp is Notarised, the certificate is Apostilled. */
export const NOC_CHECK_STEP: Partial<Record<NocCheckKey, 'notarised' | 'apostilled'>> = {
  notary_stamp: 'notarised',
  apostille: 'apostilled',
};

/** Accept unlocks only when every check that applies is ticked. */
export function allChecksTicked(
  checks: readonly NocCheckDef[],
  ticked: Readonly<Record<string, unknown>> | null | undefined,
): boolean {
  return checks.length > 0 && checks.every((c) => Boolean(ticked?.[c.key]));
}

export interface NocAnswers {
  ownershipType?: string | null;
  companyType?: string | null;
  parentIndianRelationship?: string | null;
}

export interface NocVariantPath {
  ownership: 'standalone' | 'subsidiary';
  parent: 'foreign' | 'indian' | null;
  role: 'name_only' | 'investing' | 'not_chosen' | null;
  /** The variant, "none" for a standalone company, "incomplete" for an Indian parent with no role yet. */
  result: NocVariant | 'none' | 'incomplete';
}

/**
 * C8: the lit path through the decision tree. Built on `resolveNocVariant()` and the same
 * coercions, so the path and the chosen variant can never disagree.
 */
export function nocVariantPath(answers: NocAnswers): NocVariantPath {
  const variant = resolveNocVariant(answers);
  if (coerceOwnershipType(answers.ownershipType) === 'independent') {
    return { ownership: 'standalone', parent: null, role: null, result: 'none' };
  }
  if (answers.companyType === 'foreign') {
    return { ownership: 'subsidiary', parent: 'foreign', role: null, result: variant ?? 'incomplete' };
  }
  if (answers.companyType !== 'domestic') {
    return { ownership: 'subsidiary', parent: null, role: null, result: 'incomplete' };
  }
  const rel = coerceParentIndianRelationship(answers.parentIndianRelationship);
  return {
    ownership: 'subsidiary',
    parent: 'indian',
    role: rel ?? 'not_chosen',
    result: variant ?? 'incomplete',
  };
}

/** The answers that select a variant, for a staff template override (generation reads these). */
export function answersForVariant(variant: NocVariant): Required<NocAnswers> {
  switch (variant) {
    case 'foreign-parent':
      return { ownershipType: 'subsidiary', companyType: 'foreign', parentIndianRelationship: null };
    case 'indian-name-only':
      return { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'name_only' };
    case 'indian-investing':
      return { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'investing' };
  }
}

/**
 * The engagement as generation should read it: with a staff override the three answers are
 * replaced so `boardResolutionVariant()` picks the chosen template. Other fields are untouched.
 */
export function withNocVariantOverride<T extends NocAnswers>(engagement: T, override: NocVariant | null | undefined): T {
  if (!override) return engagement;
  return { ...engagement, ...answersForVariant(override) } as T;
}
