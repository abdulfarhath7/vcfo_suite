import { describe, expect, it } from 'vitest';

import { PRE1_GENDER_OPTIONS } from '@/lib/checklist-pre1-validation';
import { PRE6_OCCUPATION_OPTIONS, PRE6_QUALIFICATION_OPTIONS } from '@/lib/checklist-pre6-validation';
import {
  COMPANY_CATEGORY,
  COMPANY_CLASS,
  COMPANY_TYPE,
  EDUCATION,
  GENDER,
  INTEREST_DESIGNATION,
  OCCUPATION_TYPE,
  companyStructureForName,
  mcaTerm,
} from '@/lib/assist-profile/vocabulary';

/**
 * Option text captured from the live portal
 * (`vcfo_assist/extension/schemas/spice-part-b.compact.json`, 2026-09-23).
 * A vocabulary value outside these lists would never select on the portal.
 */
const MCA_GENDER = ['Female', 'Male', 'Transgender'];
const MCA_OCCUPATION = ['Business', 'Employment', 'Government', 'Housewife', 'Others', 'Private Employment', 'Professional', 'Student'];
const MCA_EDUCATION = [
  "Bachelor's degree",
  'Diploma',
  'Doctorate or higher',
  'Master degree',
  'Others',
  'Primary education',
  'Professional',
  'Secondary education',
  'Vocational qualification',
];
const MCA_INTEREST_DESIGNATION = ['Director', 'Managing Director', 'Whole Time Director', 'Nominee Director', 'Others'];
/** SPICe+ Part A 1(a), captured. */
const MCA_COMPANY_TYPE = ['New Company (Others)', 'Private (OPC)', 'Section 8 Company', 'Nidhi Company', 'Producer Company'];

describe('vocabulary', () => {
  it('every value is captured MCA option text', () => {
    for (const v of Object.values(GENDER)) expect(MCA_GENDER).toContain(v);
    for (const v of Object.values(OCCUPATION_TYPE)) expect(MCA_OCCUPATION).toContain(v);
    for (const v of Object.values(EDUCATION)) expect(MCA_EDUCATION).toContain(v);
    for (const v of Object.values(INTEREST_DESIGNATION)) expect(MCA_INTEREST_DESIGNATION).toContain(v);
    for (const v of Object.values(COMPANY_TYPE)) expect(MCA_COMPANY_TYPE).toContain(v);
  });

  it('keys are Suite option values, so no Suite option is silently unmapped', () => {
    const suiteGender = PRE1_GENDER_OPTIONS.map((o) => o.value as string);
    for (const k of Object.keys(GENDER)) expect(suiteGender).toContain(k);
    // `other` has no honest MCA equivalent; it must be reported, not guessed.
    expect(mcaTerm(GENDER, 'other')).toBeUndefined();

    expect(Object.keys(OCCUPATION_TYPE).sort()).toEqual(PRE6_OCCUPATION_OPTIONS.map((o) => o.value as string).sort());
    expect(Object.keys(EDUCATION).sort()).toEqual(PRE6_QUALIFICATION_OPTIONS.map((o) => o.value as string).sort());
  });

  it('mcaTerm is exact on the normalised key and never passes a value through', () => {
    expect(mcaTerm(GENDER, ' Male ')).toBe('Male');
    expect(mcaTerm(GENDER, 'mal')).toBeUndefined();
    expect(mcaTerm(GENDER, '')).toBeUndefined();
    expect(mcaTerm(GENDER, undefined)).toBeUndefined();
    expect(mcaTerm(GENDER, 'toString')).toBeUndefined();
    expect(mcaTerm(INTEREST_DESIGNATION, 'Whole  Time Director')).toBe('Whole Time Director');
  });

  it('company structure comes from the legal suffix Suite validates', () => {
    expect(companyStructureForName('Test India Private Limited')).toEqual({
      type: COMPANY_TYPE.newOthers,
      class: COMPANY_CLASS.private,
      category: COMPANY_CATEGORY.limitedByShares,
    });
    expect(companyStructureForName('Test India PRIVATE  LIMITED')?.class).toBe('Private');
    expect(companyStructureForName('Test (OPC) Private Limited')).toBeUndefined();
    expect(companyStructureForName('Test LLP')).toBeUndefined();
    expect(companyStructureForName('')).toBeUndefined();
  });
});
