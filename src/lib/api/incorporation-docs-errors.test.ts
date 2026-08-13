import { describe, expect, it } from 'vitest';

import {
  collectIncorpDocsMissingFields,
  INCORP_DOCS_ERROR_CODES,
  IncorpDocsError,
  toIncorpDocsPatchError,
  validateIncorpDocsGeneration,
} from '@/lib/api/incorporation-docs-errors';

const pre6Complete = {
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
  residentDirectorUtilityBillType: 'electricity',
};

describe('collectIncorpDocsMissingFields', () => {
  it('flags missing company name and director KYC fields', () => {
    const missing = collectIncorpDocsMissingFields({
      pre6: {
        nrDirectorFirstName: 'Justin',
        nrDirectorMiddleName: 'Cheng',
        nrDirectorLastName: 'Hsu',
      },
      docs: ['dir-2'],
      directors: ['non-resident'],
    });

    expect(missing).toContain('Approved company name (Pre-5) or proposed name (Pre-1)');
    expect(missing.some((m) => m.includes('date of birth'))).toBe(true);
    expect(missing.some((m) => m.includes("father's name"))).toBe(true);
    expect(missing.some((m) => m.includes('utility bill address'))).toBe(true);
  });

  it('returns empty when required fields are present', () => {
    const missing = collectIncorpDocsMissingFields({
      pre1: { proposedName1: 'ABC India Private Limited' },
      pre5: { approvedCompanyName: 'ABC India Private Limited' },
      pre6: pre6Complete,
      docs: ['dir-2'],
      directors: ['non-resident'],
    });

    expect(missing).toEqual([]);
  });

  it('requires resident PAN and utility bill type for resident director docs', () => {
    const missing = collectIncorpDocsMissingFields({
      pre5: { approvedCompanyName: 'ABC India Private Limited' },
      pre6: {
        ...pre6Complete,
        residentDirectorPanNumber: '',
        residentDirectorUtilityBillType: '',
      },
      docs: ['dir-2'],
      directors: ['resident'],
    });

    expect(missing.some((m) => m.includes('PAN'))).toBe(true);
    expect(missing.some((m) => m.includes('utility bill type'))).toBe(true);
  });

  it('flags parent entity fields for authorisation letter', () => {
    const missing = collectIncorpDocsMissingFields({
      pre1: { proposedName1: 'ABC India Private Limited' },
      pre5: { approvedCompanyName: 'ABC India Private Limited' },
      pre6: pre6Complete,
      docs: ['authorisation-letter'],
      directors: ['company'],
    });

    expect(missing.some((m) => m.includes('Parent entity name'))).toBe(true);
    expect(missing.some((m) => m.includes('signatory'))).toBe(true);
  });
});

describe('validateIncorpDocsGeneration', () => {
  it('throws PRE6_NOT_ACCEPTED when KYC is not accepted', () => {
    expect(() =>
      validateIncorpDocsGeneration({
        checklistState: { 'pre-6': { reviewStatus: 'reviewing', status: 'in-progress' } },
      }),
    ).toThrow(IncorpDocsError);

    try {
      validateIncorpDocsGeneration({
        checklistState: { 'pre-6': { reviewStatus: 'reviewing', status: 'in-progress' } },
      });
    } catch (err) {
      expect(err).toBeInstanceOf(IncorpDocsError);
      expect((err as IncorpDocsError).code).toBe(INCORP_DOCS_ERROR_CODES.PRE6_NOT_ACCEPTED);
    }
  });

  it('throws MISSING_FIELDS with labels when merge data is incomplete', () => {
    try {
      validateIncorpDocsGeneration({
        checklistState: { 'pre-6': { reviewStatus: 'accepted', status: 'completed', responses: {} } },
        docs: ['dir-2'],
        directors: ['non-resident'],
      });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(IncorpDocsError);
      const incorpErr = err as IncorpDocsError;
      expect(incorpErr.code).toBe(INCORP_DOCS_ERROR_CODES.MISSING_FIELDS);
      expect(incorpErr.missingFields?.length).toBeGreaterThan(0);
    }
  });
});

describe('toIncorpDocsPatchError', () => {
  it('maps invalid patched document XML to PATCH_FAILED', () => {
    const err = toIncorpDocsPatchError(new Error('word/document.xml: 2:13365: unexpected close tag.'));
    expect(err.code).toBe(INCORP_DOCS_ERROR_CODES.PATCH_FAILED);
    expect(err.message).toContain('Re-generate this draft');
  });
});
