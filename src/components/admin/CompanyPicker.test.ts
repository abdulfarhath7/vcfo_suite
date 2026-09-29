import { describe, expect, it } from 'vitest';
import { companyPickerHint } from './company-picker-utils';

describe('companyPickerHint', () => {
  it('pairs legal form with the ownership label', () => {
    expect(
      companyPickerHint({
        companyType: 'domestic',
        ownershipType: 'independent',
        entityLegalForm: 'company',
      }),
    ).toBe('Company (Pvt Ltd) · Standalone');
    expect(
      companyPickerHint({ companyType: 'foreign', ownershipType: 'subsidiary', entityLegalForm: 'llp' }),
    ).toBe('LLP · Group · Foreign parent');
  });

  it('names the Indian parent role when chosen', () => {
    expect(
      companyPickerHint({
        companyType: 'domestic',
        ownershipType: 'subsidiary',
        parentIndianRelationship: 'name_only',
      }),
    ).toBe('Group · Indian parent (name use)');
    expect(
      companyPickerHint({
        companyType: 'domestic',
        ownershipType: 'subsidiary',
        parentIndianRelationship: 'investing',
      }),
    ).toBe('Group · Indian parent (investing)');
  });

  it('falls back to the ownership label when legal form is missing', () => {
    // Legacy row: no ownershipType (= subsidiary), no role chosen yet.
    expect(companyPickerHint({ companyType: 'domestic' })).toBe('Group · Indian parent');
  });
});
