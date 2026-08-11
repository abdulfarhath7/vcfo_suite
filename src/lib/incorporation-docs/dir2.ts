import type { IncorpDirectorKind, IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import {
  directorField,
  directorNationalityLabel,
  directorOccupationLabel,
  documentPlaceForDirector,
  formatDocumentDate,
  formatDob,
  identityProofForDirector,
  pickString,
  residenceProofForDirector,
  resolveProposedCompanyName,
} from '@/lib/incorporation-docs/shared';

export interface Dir2MergeFields {
  PROPOSED_COMPANY_NAME: string;
  DIRECTOR_FULL_NAME: string;
  DIRECTOR_DIN: string;
  FATHERS_NAME: string;
  DIRECTOR_ADDRESS: string;
  DIRECTOR_EMAIL: string;
  DIRECTOR_MOBILE: string;
  DIRECTOR_PAN: string;
  DIRECTOR_OCCUPATION: string;
  DIRECTOR_DOB: string;
  DIRECTOR_NATIONALITY: string;
  DIRECTOR_OTHER_DIRECTORSHIPS: string;
  DIRECTOR_MEMBERSHIP: string;
  DOCUMENT_DATE: string;
  DOCUMENT_PLACE: string;
  IDENTITY_PROOF: string;
  RESIDENCE_PROOF: string;
}

export const DIR2_MERGE_FIELD_KEYS = [
  'PROPOSED_COMPANY_NAME',
  'DIRECTOR_FULL_NAME',
  'DIRECTOR_DIN',
  'FATHERS_NAME',
  'DIRECTOR_ADDRESS',
  'DIRECTOR_EMAIL',
  'DIRECTOR_MOBILE',
  'DIRECTOR_PAN',
  'DIRECTOR_OCCUPATION',
  'DIRECTOR_DOB',
  'DIRECTOR_NATIONALITY',
  'DIRECTOR_OTHER_DIRECTORSHIPS',
  'DIRECTOR_MEMBERSHIP',
  'DOCUMENT_DATE',
  'DOCUMENT_PLACE',
  'IDENTITY_PROOF',
  'RESIDENCE_PROOF',
] as const satisfies readonly (keyof Dir2MergeFields)[];

export function buildDir2MergeFields(
  input: IncorpMergeInput & { overrides?: Partial<Dir2MergeFields> },
): Dir2MergeFields {
  const { engagement, pre1 = {}, pre5 = {}, pre6 = {}, director, overrides = {} } = input;
  const d = director as IncorpDirectorKind;
  const now = new Date();
  const isResident = d === 'resident';

  const fields: Dir2MergeFields = {
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    DIRECTOR_FULL_NAME: pickString(directorField(pre6, d, 'FullName'), '[Director name]'),
    DIRECTOR_DIN: '-',
    FATHERS_NAME: pickString(directorField(pre6, d, 'FatherName'), "[Father's name]"),
    DIRECTOR_ADDRESS: pickString(directorField(pre6, d, 'UtilityBillAddress'), '[Address]'),
    DIRECTOR_EMAIL: pickString(
      directorField(pre6, d, 'PersonalMailId'),
      directorField(pre6, d, 'OfficialMailId'),
      '[Email]',
    ),
    DIRECTOR_MOBILE: pickString(directorField(pre6, d, 'MobileNumber'), '[Mobile]'),
    DIRECTOR_PAN: isResident
      ? pickString(directorField(pre6, d, 'PanNumber'), 'NA')
      : 'NA',
    DIRECTOR_OCCUPATION: directorOccupationLabel(pre6, d),
    DIRECTOR_DOB: formatDob(directorField(pre6, d, 'Dob')),
    DIRECTOR_NATIONALITY: directorNationalityLabel(d),
    DIRECTOR_OTHER_DIRECTORSHIPS: 'NIL',
    DIRECTOR_MEMBERSHIP: 'NIL',
    DOCUMENT_DATE: formatDocumentDate(now),
    DOCUMENT_PLACE: documentPlaceForDirector(d),
    IDENTITY_PROOF: identityProofForDirector(d),
    RESIDENCE_PROOF: residenceProofForDirector(pre6, d),
  };

  return { ...fields, ...overrides };
}
