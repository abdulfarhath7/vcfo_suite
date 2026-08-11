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
} from '@/lib/incorporation-docs/parent-entity';

export interface AcceptanceLetterMergeFields {
  DOCUMENT_DATE: string;
  PARENT_ENTITY_NAME_AND_ADDRESS: string;
  PARENT_ENTITY_NAME: string;
  NR_DIRECTOR_FULL_NAME: string;
  NR_FATHERS_NAME: string;
  NR_PASSPORT_NUMBER: string;
  NR_DIRECTOR_ADDRESS: string;
  AUTHORISATION_DATE: string;
  PROPOSED_COMPANY_NAME: string;
  CERTIFICATION_PLACE: string;
}

export const ACCEPTANCE_LETTER_MERGE_FIELD_KEYS = [
  'DOCUMENT_DATE',
  'PARENT_ENTITY_NAME_AND_ADDRESS',
  'PARENT_ENTITY_NAME',
  'NR_DIRECTOR_FULL_NAME',
  'NR_FATHERS_NAME',
  'NR_PASSPORT_NUMBER',
  'NR_DIRECTOR_ADDRESS',
  'AUTHORISATION_DATE',
  'PROPOSED_COMPANY_NAME',
  'CERTIFICATION_PLACE',
] as const satisfies readonly (keyof AcceptanceLetterMergeFields)[];

export function buildAcceptanceLetterMergeFields(
  input: IncorpMergeInput & { overrides?: Partial<AcceptanceLetterMergeFields> },
): AcceptanceLetterMergeFields {
  const { engagement, pre1 = {}, pre5 = {}, pre6 = {}, overrides = {} } = input;
  const now = new Date();
  const docDate = formatDocumentDate(now);
  const parentName = resolveParentEntityName(pre1, engagement);
  const parentAddress = resolveParentEntityAddress(pre1, engagement);

  const fields: AcceptanceLetterMergeFields = {
    DOCUMENT_DATE: docDate,
    PARENT_ENTITY_NAME_AND_ADDRESS: `${parentName}, ${parentAddress}`,
    PARENT_ENTITY_NAME: parentName,
    NR_DIRECTOR_FULL_NAME: pickString(
      directorField(pre6, 'non-resident', 'FullName'),
      '[Non-resident director name]',
    ),
    NR_FATHERS_NAME: pickString(
      directorField(pre6, 'non-resident', 'FatherName'),
      "[Father's name]",
    ),
    NR_PASSPORT_NUMBER: pickString(
      directorField(pre6, 'non-resident', 'PassportNumber'),
      '[Passport number]',
    ),
    NR_DIRECTOR_ADDRESS: pickString(
      directorField(pre6, 'non-resident', 'UtilityBillAddress'),
      '[Non-resident director address]',
    ),
    AUTHORISATION_DATE: docDate,
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    CERTIFICATION_PLACE: resolveParentEntityCountry(pre1, engagement),
  };

  return { ...fields, ...overrides };
}

export function collectAcceptanceLetterMissingFields(input: IncorpMergeInput): string[] {
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
  if (!directorField(pre6, 'non-resident', 'FatherName')) {
    missing.push("Non-resident director — father's name (Pre-6)");
  }
  if (!directorField(pre6, 'non-resident', 'PassportNumber')) {
    missing.push('Non-resident director — passport number (Pre-6)');
  }
  if (!directorField(pre6, 'non-resident', 'UtilityBillAddress')) {
    missing.push('Non-resident director — utility bill address (Pre-6)');
  }
  const company = resolveProposedCompanyName(input.pre5 ?? {}, pre1, input.engagement);
  if (!company || company.startsWith('[')) {
    missing.push('Approved company name (Pre-5) or proposed name (Pre-1)');
  }

  return missing;
}
