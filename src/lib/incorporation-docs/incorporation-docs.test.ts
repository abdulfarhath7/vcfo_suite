import { describe, expect, it } from 'vitest';

import { buildDir8MergeFields } from '@/lib/incorporation-docs/dir8';
import { buildInc9MergeFields } from '@/lib/incorporation-docs/inc9';
import { buildPanUndertakingMergeFields } from '@/lib/incorporation-docs/pan-undertaking';
import { nationalityFromAddress } from '@/lib/incorporation-docs/shared';

const pre6Base = {
  nrDirectorFirstName: 'Justin',
  nrDirectorMiddleName: 'Cheng',
  nrDirectorLastName: 'Hsu',
  nrDirectorDob: '1980-02-25',
  nrDirectorFatherName: 'Robert Hsu',
  nrDirectorPassportNumber: 'P2982018',
  nrDirectorUtilityBillAddress: '2544 Horsetail Road, Frisco, Texas 75033, USA',
  nrDirectorPersonalMailId: 'justin@example.com',
  nrDirectorMobileNumber: '+1 555 0100',
  residentDirectorFirstName: 'Priya',
  residentDirectorLastName: 'Sharma',
  residentDirectorDob: '1990-06-15',
  residentDirectorFatherName: 'Raj Sharma',
  residentDirectorUtilityBillAddress: '12 MG Road, Bengaluru, Karnataka 560001, India',
  residentDirectorPersonalMailId: 'priya@example.com',
  residentDirectorMobileNumber: '+91 9876543210',
  residentDirectorPanNumber: 'ABCDE1234F',
};

describe('buildDir8MergeFields', () => {
  it('maps director details and prior directorship NA defaults', () => {
    const fields = buildDir8MergeFields({
      pre5: { approvedCompanyName: 'ABC India Private Limited' },
      pre6: pre6Base,
      director: 'non-resident',
    });

    expect(fields.PROPOSED_COMPANY_NAME).toBe('ABC India Private Limited');
    expect(fields.DIRECTOR_FULL_NAME).toBe('Justin Cheng Hsu');
    expect(fields.FATHERS_NAME).toBe('Robert Hsu');
    expect(fields.PRIOR_DIR_COMPANY).toBe('NA');
    expect(fields.DOCUMENT_PLACE).toBe('Foreign');
    expect(fields.DOCUMENT_DATE_DAY1).toBeTruthy();
  });
});

describe('buildInc9MergeFields', () => {
  it('maps company and director for declaration', () => {
    const fields = buildInc9MergeFields({
      pre1: { proposedName1: 'ABC India Private Limited' },
      pre6: pre6Base,
      director: 'resident',
    });

    expect(fields.PROPOSED_COMPANY_NAME).toBe('ABC India Private Limited');
    expect(fields.DIRECTOR_FULL_NAME).toBe('Priya Sharma');
    expect(fields.DOCUMENT_PLACE).toBe('India');
  });
});

describe('buildPanUndertakingMergeFields', () => {
  it('maps non-resident passport and nationality from address', () => {
    const fields = buildPanUndertakingMergeFields({
      pre6: pre6Base,
      director: 'non-resident',
    });

    expect(fields.DIRECTOR_FULL_NAME).toBe('Justin Cheng Hsu');
    expect(fields.FATHERS_NAME).toBe('Robert Hsu');
    expect(fields.PASSPORT_NUMBER).toBe('P2982018');
    expect(fields.DIRECTOR_NATIONALITY).toBe('United States of America');
  });
});

describe('nationalityFromAddress', () => {
  it('expands USA suffix', () => {
    expect(nationalityFromAddress('Frisco, Texas, USA')).toBe('United States of America');
  });
});
