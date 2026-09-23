import type { IncorpDirectorAudience, IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import {
  directorField,
  directorOtherInterests,
  formatDob,
  relationOf,
  signingDate,
  signingPlace,
  pickString,
  resolveProposedCompanyName,
  splitDocumentDateForRuns,
} from '@/lib/incorporation-docs/shared';

export interface Dir8PriorDirectorshipRow {
  PRIOR_DIR_COMPANY: string;
  PRIOR_DIR_CIN: string;
  PRIOR_DIR_FROM: string;
  PRIOR_DIR_TO: string;
}

export interface Dir8MergeFields {
  PROPOSED_COMPANY_NAME: string;
  DIRECTOR_FULL_NAME: string;
  RELATION_OF: string;
  FATHERS_NAME: string;
  DIRECTOR_ADDRESS: string;
  PRIOR_DIR_COMPANY: string;
  PRIOR_DIR_CIN: string;
  PRIOR_DIR_FROM: string;
  PRIOR_DIR_TO: string;
  /** Row loop in the template; one `NA` row when the director has no other interests. */
  PRIOR_DIRECTORSHIPS: Dir8PriorDirectorshipRow[];
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
  'RELATION_OF',
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

/** Keys rendered as docxtemplater row loops rather than strings. */
export const DIR8_LOOP_KEYS = ['PRIOR_DIRECTORSHIPS'] as const satisfies readonly (keyof Dir8MergeFields)[];

const NA_ROW: Dir8PriorDirectorshipRow = {
  PRIOR_DIR_COMPANY: 'NA',
  PRIOR_DIR_CIN: 'NA',
  PRIOR_DIR_FROM: 'NA',
  PRIOR_DIR_TO: 'NA',
};

export function buildDir8MergeFields(
  input: IncorpMergeInput & { overrides?: Partial<Dir8MergeFields> },
): Dir8MergeFields {
  const { engagement, pre1 = {}, pre5 = {}, pre6 = {}, director, overrides = {} } = input;
  const d = director as IncorpDirectorAudience;
  const now = signingDate(input);
  const rows: Dir8PriorDirectorshipRow[] = directorOtherInterests(pre6, d).map((i) => ({
    PRIOR_DIR_COMPANY: i.company,
    PRIOR_DIR_CIN: i.cin || 'NA',
    PRIOR_DIR_FROM: i.from ? formatDob(i.from) : 'NA',
    PRIOR_DIR_TO: i.to ? formatDob(i.to) : 'Till date',
  }));
  const tableRows = rows.length > 0 ? rows : [NA_ROW];

  const fields: Dir8MergeFields = {
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    DIRECTOR_FULL_NAME: pickString(directorField(pre6, d, 'FullName'), '[Director name]'),
    RELATION_OF: relationOf(pre6, d),
    FATHERS_NAME: pickString(directorField(pre6, d, 'FatherName'), "[Father's name]"),
    DIRECTOR_ADDRESS: pickString(directorField(pre6, d, 'UtilityBillAddress'), '[Address]'),
    ...tableRows[0]!,
    PRIOR_DIRECTORSHIPS: tableRows,
    ...splitDocumentDateForRuns(now),
    DOCUMENT_PLACE: signingPlace(input, d),
  };

  return { ...fields, ...overrides };
}
