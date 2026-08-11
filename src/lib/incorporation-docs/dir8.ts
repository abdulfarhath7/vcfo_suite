import type { IncorpDirectorKind, IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import {
  directorField,
  documentPlaceForDirector,
  pickString,
  resolveProposedCompanyName,
  splitDocumentDateForRuns,
} from '@/lib/incorporation-docs/shared';

export interface Dir8MergeFields {
  PROPOSED_COMPANY_NAME: string;
  DIRECTOR_FULL_NAME: string;
  FATHERS_NAME: string;
  DIRECTOR_ADDRESS: string;
  PRIOR_DIR_COMPANY: string;
  PRIOR_DIR_CIN: string;
  PRIOR_DIR_FROM: string;
  PRIOR_DIR_TO: string;
  DOCUMENT_DATE_DAY1: string;
  DOCUMENT_DATE_DAY2: string;
  DOCUMENT_DATE_ORDINAL: string;
  DOCUMENT_DATE_SPACE1: string;
  DOCUMENT_DATE_MONTH: string;
  DOCUMENT_DATE_YEAR_PREFIX: string;
  DOCUMENT_DATE_YEAR: string;
  DOCUMENT_PLACE: string;
}

export const DIR8_MERGE_FIELD_KEYS = [
  'PROPOSED_COMPANY_NAME',
  'DIRECTOR_FULL_NAME',
  'FATHERS_NAME',
  'DIRECTOR_ADDRESS',
  'PRIOR_DIR_COMPANY',
  'PRIOR_DIR_CIN',
  'PRIOR_DIR_FROM',
  'PRIOR_DIR_TO',
  'DOCUMENT_DATE_DAY1',
  'DOCUMENT_DATE_DAY2',
  'DOCUMENT_DATE_ORDINAL',
  'DOCUMENT_DATE_SPACE1',
  'DOCUMENT_DATE_MONTH',
  'DOCUMENT_DATE_YEAR_PREFIX',
  'DOCUMENT_DATE_YEAR',
  'DOCUMENT_PLACE',
] as const satisfies readonly (keyof Dir8MergeFields)[];

export function buildDir8MergeFields(
  input: IncorpMergeInput & { overrides?: Partial<Dir8MergeFields> },
): Dir8MergeFields {
  const { engagement, pre1 = {}, pre5 = {}, pre6 = {}, director, overrides = {} } = input;
  const d = director as IncorpDirectorKind;
  const now = new Date();

  const fields: Dir8MergeFields = {
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    DIRECTOR_FULL_NAME: pickString(directorField(pre6, d, 'FullName'), '[Director name]'),
    FATHERS_NAME: pickString(directorField(pre6, d, 'FatherName'), "[Father's name]"),
    DIRECTOR_ADDRESS: pickString(directorField(pre6, d, 'UtilityBillAddress'), '[Address]'),
    PRIOR_DIR_COMPANY: 'NA',
    PRIOR_DIR_CIN: 'NA',
    PRIOR_DIR_FROM: 'NA',
    PRIOR_DIR_TO: 'NA',
    ...splitDocumentDateForRuns(now),
    DOCUMENT_PLACE: documentPlaceForDirector(d),
  };

  return { ...fields, ...overrides };
}
