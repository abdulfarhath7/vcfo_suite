import type { IncorpDirectorKind, IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import {
  directorField,
  documentPlaceForDirector,
  formatDocumentDate,
  pickString,
  resolveProposedCompanyName,
} from '@/lib/incorporation-docs/shared';

export interface Inc9MergeFields {
  PROPOSED_COMPANY_NAME: string;
  DIRECTOR_FULL_NAME: string;
  DOCUMENT_DATE: string;
  DOCUMENT_PLACE: string;
}

export const INC9_MERGE_FIELD_KEYS = [
  'PROPOSED_COMPANY_NAME',
  'DIRECTOR_FULL_NAME',
  'DOCUMENT_DATE',
  'DOCUMENT_PLACE',
] as const satisfies readonly (keyof Inc9MergeFields)[];

export function buildInc9MergeFields(
  input: IncorpMergeInput & { overrides?: Partial<Inc9MergeFields> },
): Inc9MergeFields {
  const { engagement, pre1 = {}, pre5 = {}, pre6 = {}, director, overrides = {} } = input;
  const d = director as IncorpDirectorKind;
  const now = new Date();

  const fields: Inc9MergeFields = {
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    DIRECTOR_FULL_NAME: pickString(directorField(pre6, d, 'FullName'), '[Director name]'),
    DOCUMENT_DATE: formatDocumentDate(now),
    DOCUMENT_PLACE: documentPlaceForDirector(d),
  };

  return { ...fields, ...overrides };
}
