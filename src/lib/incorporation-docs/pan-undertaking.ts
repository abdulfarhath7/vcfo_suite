import type { IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import {
  directorField,
  documentPlaceForDirector,
  formatDocumentDate,
  nationalityFromAddress,
  pickString,
} from '@/lib/incorporation-docs/shared';

export interface PanUndertakingMergeFields {
  DIRECTOR_FULL_NAME: string;
  FATHERS_NAME: string;
  DIRECTOR_NATIONALITY: string;
  PASSPORT_NUMBER: string;
  DOCUMENT_DATE: string;
  DOCUMENT_PLACE: string;
}

export const PAN_UNDERTAKING_MERGE_FIELD_KEYS = [
  'DIRECTOR_FULL_NAME',
  'FATHERS_NAME',
  'DIRECTOR_NATIONALITY',
  'PASSPORT_NUMBER',
  'DOCUMENT_DATE',
  'DOCUMENT_PLACE',
] as const satisfies readonly (keyof PanUndertakingMergeFields)[];

export function buildPanUndertakingMergeFields(
  input: IncorpMergeInput & { overrides?: Partial<PanUndertakingMergeFields> },
): PanUndertakingMergeFields {
  const { pre6 = {}, overrides = {} } = input;
  const now = new Date();
  const address = directorField(pre6, 'non-resident', 'UtilityBillAddress');

  const fields: PanUndertakingMergeFields = {
    DIRECTOR_FULL_NAME: pickString(
      directorField(pre6, 'non-resident', 'FullName'),
      '[Director name]',
    ),
    FATHERS_NAME: pickString(
      directorField(pre6, 'non-resident', 'FatherName'),
      "[Father's name]",
    ),
    DIRECTOR_NATIONALITY: nationalityFromAddress(address),
    PASSPORT_NUMBER: pickString(
      directorField(pre6, 'non-resident', 'PassportNumber'),
      '[Passport number]',
    ),
    DOCUMENT_DATE: formatDocumentDate(now),
    DOCUMENT_PLACE: documentPlaceForDirector('non-resident'),
  };

  return { ...fields, ...overrides };
}
