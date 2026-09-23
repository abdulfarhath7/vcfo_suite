import type { IncorpDirectorAudience, IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import { directorAudienceKind } from '@/lib/incorporation-docs/audiences';
import {
  directorField,
  relationOf,
  signingDate,
  signingPlace,
  formatDocumentDate,
  nationalityFromAddress,
  pickString,
} from '@/lib/incorporation-docs/shared';

export interface PanUndertakingMergeFields {
  DIRECTOR_FULL_NAME: string;
  RELATION_OF: string;
  FATHERS_NAME: string;
  DIRECTOR_NATIONALITY: string;
  PASSPORT_NUMBER: string;
  DOCUMENT_DATE: string;
  DOCUMENT_PLACE: string;
}

export const PAN_UNDERTAKING_MERGE_FIELD_KEYS = [
  'DIRECTOR_FULL_NAME',
  'RELATION_OF',
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
  // Written for a non-resident director; company / resident callers get the first one.
  const d: IncorpDirectorAudience =
    input.director !== 'company' && directorAudienceKind(input.director) === 'non-resident'
      ? input.director
      : 'non-resident';
  const now = signingDate(input);
  const address = directorField(pre6, d, 'UtilityBillAddress');

  const fields: PanUndertakingMergeFields = {
    DIRECTOR_FULL_NAME: pickString(
      directorField(pre6, d, 'FullName'),
      '[Director name]',
    ),
    RELATION_OF: relationOf(pre6, d, true),
    FATHERS_NAME: pickString(
      directorField(pre6, d, 'FatherName'),
      "[Father's name]",
    ),
    DIRECTOR_NATIONALITY: nationalityFromAddress(address),
    PASSPORT_NUMBER: pickString(
      directorField(pre6, d, 'PassportNumber'),
      '[Passport number]',
    ),
    DOCUMENT_DATE: formatDocumentDate(now),
    DOCUMENT_PLACE: signingPlace(input, d),
  };

  return { ...fields, ...overrides };
}
