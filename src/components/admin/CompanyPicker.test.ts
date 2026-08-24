import { describe, expect, it } from 'vitest';
import { companyPickerHint } from './company-picker-utils';

describe('companyPickerHint', () => {
  it('pairs legal form with domestic/foreign', () => {
    expect(companyPickerHint({ companyType: 'domestic', entityLegalForm: 'company' })).toBe(
      'Company (Pvt Ltd) · Domestic',
    );
    expect(companyPickerHint({ companyType: 'foreign', entityLegalForm: 'llp' })).toBe('LLP · Foreign');
  });

  it('falls back to company type when legal form is missing', () => {
    expect(companyPickerHint({ companyType: 'domestic' })).toBe('Domestic');
  });
});
