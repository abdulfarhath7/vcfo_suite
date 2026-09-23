/**
 * MCA's vocabulary, not Suite's. These strings must match the portal's
 * dropdown text character for character. When MCA changes a label, this is
 * the only file that changes.
 *
 * Source: the option lists captured from the live portal into
 * `vcfo_assist/extension/schemas/*.compact.json` (2026-09-23). Where MCA
 * loads a list only after a parent choice (class / category / sub-category
 * of company), the text is the one Assist's own sample profile uses.
 *
 * Keys on the left are Suite's stored option values (`src/lib/checklist-*`
 * option tables). A Suite value with no key here has no MCA equivalent
 * mapped: the builder reports it missing and never passes it through raw.
 */

/** SPICe+ Part A 1(a) "Type of company" — captured option text. */
export const COMPANY_TYPE = { newOthers: 'New Company (Others)' } as const;
/** SPICe+ Part A "Class of the company". */
export const COMPANY_CLASS = { private: 'Private', public: 'Public' } as const;
/** SPICe+ Part A "Category of the company". */
export const COMPANY_CATEGORY = { limitedByShares: 'Company limited by shares' } as const;
/** SPICe+ Part A "Sub-category of the company". Suite does not hold the sub-category yet. */
export const COMPANY_SUBCATEGORY = { nonGovernment: 'Non-government company' } as const;

export interface CompanyStructure {
  type: string;
  class: string;
  category: string;
}

/**
 * Company structure by the proposed name's legal suffix. Suite's Part A
 * validation requires every proposed name to end in "India Private Limited"
 * (`checklist-pre1-validation.ts`), so the suffix is a Suite fact, not a guess.
 * Longest suffix first; a name matching none has no MCA equivalent mapped.
 */
export const COMPANY_STRUCTURE_BY_NAME_SUFFIX: ReadonlyArray<readonly [suffix: string, structure: CompanyStructure]> = [
  [
    'private limited',
    {
      type: COMPANY_TYPE.newOthers,
      class: COMPANY_CLASS.private,
      category: COMPANY_CATEGORY.limitedByShares,
    },
  ],
];

/** Suite gender (`PRE1_GENDER_OPTIONS`) → Part B gender dropdown. `other` has no MCA equivalent mapped. */
export const GENDER: Readonly<Record<string, string>> = {
  male: 'Male',
  female: 'Female',
};

/** Suite occupation (`PRE6_OCCUPATION_OPTIONS`) → Part B "Occupation type". */
export const OCCUPATION_TYPE: Readonly<Record<string, string>> = {
  business: 'Business',
  professional: 'Professional',
  'government-employment': 'Government',
  'private-employment': 'Private Employment',
  housewife: 'Housewife',
  student: 'Student',
  others: 'Others',
};

/** Suite qualification (`PRE6_QUALIFICATION_OPTIONS`) → Part B "Educational qualification". */
export const EDUCATION: Readonly<Record<string, string>> = {
  'primary-education': 'Primary education',
  'secondary-education': 'Secondary education',
  'vocational-qualification': 'Vocational qualification',
  'bachelors-degree': "Bachelor's degree",
  'master-degree': 'Master degree',
  'doctorate-or-higher': 'Doctorate or higher',
  professional: 'Professional',
  diploma: 'Diploma',
  others: 'Others',
};

/**
 * Free-text designation of a director's other interest (`pre-15`) → Part B 7(a)
 * "Designation" dropdown. Keys are the lower-cased, space-collapsed Suite text.
 */
export const INTEREST_DESIGNATION: Readonly<Record<string, string>> = {
  director: 'Director',
  'managing director': 'Managing Director',
  'whole time director': 'Whole Time Director',
  'whole-time director': 'Whole Time Director',
  'nominee director': 'Nominee Director',
};

/** Registered office country: SPICe+ incorporates Indian companies only. */
export const COUNTRY_INDIA = 'India';

/** Look up a Suite option value; `undefined` when the table has no entry. */
export function mcaTerm(table: Readonly<Record<string, string>>, suiteValue: string | undefined): string | undefined {
  const key = (suiteValue ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return undefined;
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/** Company structure for a proposed name, or `undefined` when no suffix matches. */
export function companyStructureForName(name: string): CompanyStructure | undefined {
  const normalised = name.trim().toLowerCase().replace(/\s+/g, ' ');
  // A One Person Company also ends in "Private Limited" but is a different MCA type.
  if (!normalised || normalised.includes('(opc)')) return undefined;
  return COMPANY_STRUCTURE_BY_NAME_SUFFIX.find(([suffix]) => normalised.endsWith(suffix))?.[1];
}
