import { properNameCase } from '@/lib/names/name-casing';
import type { IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import { signingDate } from '@/lib/incorporation-docs/shared';
import {
  directorField,
  formatDocumentDate,
  pickString,
  resolveProposedCompanyName,
} from '@/lib/incorporation-docs/shared';
import {
  resolveParentEntityAddress,
  resolveParentEntityCountry,
  resolveParentEntityJurisdiction,
  resolveParentEntityName,
  resolveParentEntityRegistration,
  resolveParentEntityState,
} from '@/lib/incorporation-docs/parent-entity';
import { resolveSignatoryDisplayName } from '@/lib/person-name';
import { parentCountryAnswer } from '@/lib/incorporation/parent-jurisdiction';
import { parsePre1BoardResolutionDate } from '@/lib/checklist/checklist-pre1-validation';
import {
  directorAudienceLabel,
  isDirectorAudience,
  type IncorpDirectorAudience,
} from '@/lib/incorporation-docs/audiences';

/**
 * AUTHORISATION LETTER — the parent entity authorises one director who is not
 * resident in India to subscribe and sign for it. One letter per such director
 * (`directors: 'non-resident-only'`); the parent signs through the person who
 * signs its board resolution (Part A, "Person Signing the Board Resolution").
 */

/** The director a letter is written for; a company-level caller gets the first non-resident. */
function letterDirector(input: IncorpMergeInput): IncorpDirectorAudience {
  return input.director !== 'company' && isDirectorAudience(input.director) ? input.director : 'non-resident';
}

export interface AuthorisationLetterMergeFields {
  DOCUMENT_DATE: string;
  /** "…pursuant to the Board Resolution dated …" — the Part A board resolution date. */
  BOARD_RESOLUTION_DATE: string;
  PARENT_ENTITY_NAME: string;
  /** "…under the laws of the {STATE}, {COUNTRY}"; blank drops both for {JURISDICTION}. */
  PARENT_ENTITY_STATE: string;
  PARENT_ENTITY_COUNTRY: string;
  /** "the United Kingdom" — printed instead of state + country when there is no state. */
  PARENT_ENTITY_JURISDICTION: string;
  PARENT_ENTITY_ADDRESS: string;
  NR_DIRECTOR_FULL_NAME: string;
  NR_PASSPORT_OR_REGISTRATION: string;
  NR_DIRECTOR_ADDRESS: string;
  PROPOSED_COMPANY_NAME: string;
  SIGNATORY_NAME: string;
  SIGNATORY_DESIGNATION: string;
  CERTIFICATION_DATE: string;
  CERTIFICATION_PLACE: string;
}

export const AUTHORISATION_LETTER_MERGE_FIELD_KEYS = [
  'DOCUMENT_DATE',
  'BOARD_RESOLUTION_DATE',
  'PARENT_ENTITY_NAME',
  'PARENT_ENTITY_STATE',
  'PARENT_ENTITY_COUNTRY',
  'PARENT_ENTITY_JURISDICTION',
  'PARENT_ENTITY_ADDRESS',
  'NR_DIRECTOR_FULL_NAME',
  'NR_PASSPORT_OR_REGISTRATION',
  'NR_DIRECTOR_ADDRESS',
  'PROPOSED_COMPANY_NAME',
  'SIGNATORY_NAME',
  'SIGNATORY_DESIGNATION',
  'CERTIFICATION_DATE',
  'CERTIFICATION_PLACE',
] as const satisfies readonly (keyof AuthorisationLetterMergeFields)[];

export function buildAuthorisationLetterMergeFields(
  input: IncorpMergeInput & { overrides?: Partial<AuthorisationLetterMergeFields> },
): AuthorisationLetterMergeFields {
  const { engagement, pre1 = {}, pre5 = {}, pre6 = {}, overrides = {} } = input;
  const now = signingDate(input);
  const docDate = formatDocumentDate(now);
  const director = letterDirector(input);
  const resolutionDate = parsePre1BoardResolutionDate(pre1.boardResolutionDate) ?? now;

  const state = resolveParentEntityState(pre1, engagement);

  const fields: AuthorisationLetterMergeFields = {
    DOCUMENT_DATE: docDate,
    BOARD_RESOLUTION_DATE: formatDocumentDate(resolutionDate),
    PARENT_ENTITY_NAME: resolveParentEntityName(pre1, engagement),
    // An answered state reads "the State of Delaware"; legacy output is unchanged.
    PARENT_ENTITY_STATE: state && parentCountryAnswer(pre1) ? `State of ${state}` : state,
    PARENT_ENTITY_COUNTRY: resolveParentEntityCountry(pre1, engagement),
    PARENT_ENTITY_JURISDICTION: resolveParentEntityJurisdiction(pre1),
    PARENT_ENTITY_ADDRESS: resolveParentEntityAddress(pre1, engagement),
    NR_DIRECTOR_FULL_NAME: pickString(
      directorField(pre6, director, 'FullName'),
      '[Non-resident director name]',
    ),
    NR_PASSPORT_OR_REGISTRATION: pickString(
      directorField(pre6, director, 'PassportNumber'),
      resolveParentEntityRegistration(pre1, engagement),
    ),
    NR_DIRECTOR_ADDRESS: pickString(
      directorField(pre6, director, 'UtilityBillAddress'),
      '[Non-resident director address]',
    ),
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    SIGNATORY_NAME: properNameCase(pickString(resolveSignatoryDisplayName(pre1), '[Signatory name]')),
    SIGNATORY_DESIGNATION: pickString(pre1.signatoryDesignation, '[Signatory designation]'),
    CERTIFICATION_DATE: docDate,
    CERTIFICATION_PLACE: resolveParentEntityCountry(pre1, engagement),
  };

  return { ...fields, ...overrides };
}

export function collectAuthorisationLetterMissingFields(input: IncorpMergeInput): string[] {
  const missing: string[] = [];
  const pre1 = input.pre1 ?? {};
  const pre6 = input.pre6 ?? {};
  const director = letterDirector(input);
  const who = directorAudienceLabel(director);

  if (!resolveParentEntityName(pre1, input.engagement).trim() || resolveParentEntityName(pre1, input.engagement).startsWith('[')) {
    missing.push('Parent entity name (Pre-1)');
  }
  if (!resolveParentEntityAddress(pre1, input.engagement).trim() || resolveParentEntityAddress(pre1, input.engagement).startsWith('[')) {
    missing.push('Parent entity address (Pre-1)');
  }
  if (!parentCountryAnswer(pre1)) {
    missing.push('Parent entity country of incorporation (Pre-1)');
  }
  if (!directorField(pre6, director, 'FullName')) {
    missing.push(`${who} — full name (Pre-6)`);
  }
  if (!directorField(pre6, director, 'PassportNumber') && !pre1.parentEntityRegistrationNumber?.trim()) {
    missing.push(`${who} passport (Pre-6) or parent registration number (Pre-1)`);
  }
  if (!directorField(pre6, director, 'UtilityBillAddress')) {
    missing.push(`${who} — utility bill address (Pre-6)`);
  }
  const company = resolveProposedCompanyName(input.pre5 ?? {}, pre1, input.engagement);
  if (!company || company.startsWith('[')) {
    missing.push('Approved company name (Pre-5) or proposed name (Pre-1)');
  }
  if (!resolveSignatoryDisplayName(pre1)) {
    missing.push('Authorized signatory name (Pre-1)');
  }
  if (!pre1.signatoryDesignation?.trim()) {
    missing.push('Authorized signatory designation (Pre-1)');
  }

  return missing;
}
