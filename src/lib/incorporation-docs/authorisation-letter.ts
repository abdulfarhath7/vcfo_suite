import type { IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import {
  directorField,
  formatDocumentDate,
  pickString,
  resolveProposedCompanyName,
} from '@/lib/incorporation-docs/shared';
import {
  resolveParentEntityAddress,
  resolveParentEntityCountry,
  resolveParentEntityName,
  resolveParentEntityRegistration,
  resolveParentEntityState,
} from '@/lib/incorporation-docs/parent-entity';
import { resolveSignatoryDisplayName } from '@/lib/person-name';

export interface AuthorisationLetterMergeFields {
  DOCUMENT_DATE: string;
  PARENT_ENTITY_NAME: string;
  PARENT_ENTITY_STATE: string;
  PARENT_ENTITY_COUNTRY: string;
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
  'PARENT_ENTITY_NAME',
  'PARENT_ENTITY_STATE',
  'PARENT_ENTITY_COUNTRY',
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
  const now = new Date();
  const docDate = formatDocumentDate(now);

  const fields: AuthorisationLetterMergeFields = {
    DOCUMENT_DATE: docDate,
    PARENT_ENTITY_NAME: resolveParentEntityName(pre1, engagement),
    PARENT_ENTITY_STATE: resolveParentEntityState(pre1, engagement),
    PARENT_ENTITY_COUNTRY: resolveParentEntityCountry(pre1, engagement),
    PARENT_ENTITY_ADDRESS: resolveParentEntityAddress(pre1, engagement),
    NR_DIRECTOR_FULL_NAME: pickString(
      directorField(pre6, 'non-resident', 'FullName'),
      '[Non-resident director name]',
    ),
    NR_PASSPORT_OR_REGISTRATION: pickString(
      directorField(pre6, 'non-resident', 'PassportNumber'),
      resolveParentEntityRegistration(pre1, engagement),
    ),
    NR_DIRECTOR_ADDRESS: pickString(
      directorField(pre6, 'non-resident', 'UtilityBillAddress'),
      '[Non-resident director address]',
    ),
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    SIGNATORY_NAME: pickString(resolveSignatoryDisplayName(pre1), '[Signatory name]'),
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

  if (!resolveParentEntityName(pre1, input.engagement).trim() || resolveParentEntityName(pre1, input.engagement).startsWith('[')) {
    missing.push('Parent entity name (Pre-1)');
  }
  if (!resolveParentEntityAddress(pre1, input.engagement).trim() || resolveParentEntityAddress(pre1, input.engagement).startsWith('[')) {
    missing.push('Parent entity address (Pre-1)');
  }
  if (!directorField(pre6, 'non-resident', 'FullName')) {
    missing.push('Non-resident director — full name (Pre-6)');
  }
  if (!directorField(pre6, 'non-resident', 'PassportNumber') && !pre1.parentEntityRegistrationNumber?.trim()) {
    missing.push('Non-resident director passport (Pre-6) or parent registration number (Pre-1)');
  }
  if (!directorField(pre6, 'non-resident', 'UtilityBillAddress')) {
    missing.push('Non-resident director — utility bill address (Pre-6)');
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
