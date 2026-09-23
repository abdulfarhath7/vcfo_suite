import type { ChecklistItemResponses } from '@/lib/checklist-responses';
import type { IncorpDirectorAudience, IncorpMergeInput } from '@/lib/incorporation-docs/shared';
import {
  directorField,
  formatDocumentDate,
  pickString,
  relationOf,
  resolveProposedCompanyName,
  signingDate,
  signingPlace,
} from '@/lib/incorporation-docs/shared';

/**
 * ID & address declaration (Rule 16(1)(m)) and deposit declaration — one
 * per director, same merge fields, laid out like INC-9. Templates are built
 * by `scripts/incorp-docx-build-declarations.mjs`.
 */
export interface DeclarationMergeFields {
  PROPOSED_COMPANY_NAME: string;
  DIRECTOR_FULL_NAME: string;
  RELATION_PREFIX: string;
  FATHERS_NAME: string;
  DIRECTOR_ADDRESS: string;
  DIRECTOR_DIN: string;
  DOCUMENT_DATE: string;
  DOCUMENT_PLACE: string;
}

export const DECLARATION_MERGE_FIELD_KEYS = [
  'PROPOSED_COMPANY_NAME',
  'DIRECTOR_FULL_NAME',
  'RELATION_PREFIX',
  'FATHERS_NAME',
  'DIRECTOR_ADDRESS',
  'DIRECTOR_DIN',
  'DOCUMENT_DATE',
  'DOCUMENT_PLACE',
] as const satisfies readonly (keyof DeclarationMergeFields)[];

/** Owner answer Q1: the ID & address declaration is only for a director who already holds a DIN. */
export function directorHoldsDin(pre6: ChecklistItemResponses, director: IncorpDirectorAudience): boolean {
  return Boolean(directorField(pre6, director, 'Din'));
}

export function buildDeclarationMergeFields(
  input: IncorpMergeInput & { overrides?: Partial<DeclarationMergeFields> },
): DeclarationMergeFields {
  const { engagement, pre1 = {}, pre5 = {}, pre6 = {}, director, overrides = {} } = input;
  const d = director as IncorpDirectorAudience;
  const relation = relationOf(pre6, d);

  const fields: DeclarationMergeFields = {
    PROPOSED_COMPANY_NAME: resolveProposedCompanyName(pre5, pre1, engagement),
    DIRECTOR_FULL_NAME: pickString(directorField(pre6, d, 'FullName'), '[Director name]'),
    RELATION_PREFIX: relation === 'daughter of' ? 'D/o' : 'S/o',
    FATHERS_NAME: pickString(directorField(pre6, d, 'FatherName'), "[Father's name]"),
    DIRECTOR_ADDRESS: pickString(directorField(pre6, d, 'UtilityBillAddress'), '[Address]'),
    DIRECTOR_DIN: pickString(directorField(pre6, d, 'Din'), '-'),
    DOCUMENT_DATE: formatDocumentDate(signingDate(input)),
    DOCUMENT_PLACE: signingPlace(input, d),
  };

  return { ...fields, ...overrides };
}
