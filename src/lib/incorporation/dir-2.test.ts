import { describe, expect, it } from 'vitest';

import { buildDir2MergeFields, dir2DownloadFilename } from '@/lib/incorporation/dir-2';

const pre6Base = {
  nrDirectorFirstName: 'Justin',
  nrDirectorMiddleName: 'Cheng',
  nrDirectorLastName: 'Hsu',
  nrDirectorDob: '1980-02-25',
  nrDirectorFatherName: 'Robert Hsu',
  nrDirectorOccupationType: 'professional',
  nrDirectorUtilityBillAddress: '2544 Horsetail Road, Frisco, Texas 75033, USA',
  nrDirectorPersonalMailId: 'justin@example.com',
  nrDirectorMobileNumber: '+1 555 0100',
  nrDirectorUtilityBillType: 'electricity',
  residentDirectorFirstName: 'Priya',
  residentDirectorLastName: 'Sharma',
  residentDirectorDob: '1990-06-15',
  residentDirectorFatherName: 'Raj Sharma',
  residentDirectorOccupationType: 'private-employment',
  residentDirectorUtilityBillAddress: '12 MG Road, Bengaluru, Karnataka 560001, India',
  residentDirectorPersonalMailId: 'priya@example.com',
  residentDirectorMobileNumber: '+91 9876543210',
  residentDirectorPanNumber: 'ABCDE1234F',
  residentDirectorUtilityBillType: 'electricity',
};

describe('dir2DownloadFilename (GL-08)', () => {
  it('names the DIR-2 after the director and the client, with the date in India', () => {
    const on = new Date('2026-11-11T06:00:00Z');
    expect(dir2DownloadFilename('resident', 'ember technologies private limited', pre6Base, on)).toBe(
      'DIR-2-Priya-Sharma_Ember-Technologies-Private-Limited_11-11-2026.docx',
    );
    expect(dir2DownloadFilename('non-resident', 'Ember', undefined, on)).toBe('DIR-2_Ember_11-11-2026.docx');
  });
});

describe('buildDir2MergeFields', () => {
  it('maps non-resident director from Pre-6 KYC', () => {
    const fields = buildDir2MergeFields({
      pre1: { proposedName1: 'ABC India Private Limited' },
      pre5: { approvedCompanyName: 'ABC India Private Limited' },
      pre6: pre6Base,
      director: 'non-resident',
    });

    expect(fields.PROPOSED_COMPANY_NAME).toBe('ABC India Private Limited');
    expect(fields.DIRECTOR_FULL_NAME).toBe('Justin Cheng Hsu');
    expect(fields.FATHERS_NAME).toBe('Robert Hsu');
    expect(fields.DIRECTOR_DOB).toBe('25/02/1980');
    expect(fields.DIRECTOR_PAN).toBe('NA');
    expect(fields.DIRECTOR_NATIONALITY).toBe('Foreign');
    expect(fields.IDENTITY_PROOF).toBe('Copy of Passport');
    expect(fields.RESIDENCE_PROOF).toBe('Copy of Driving License');
    expect(fields.DIRECTOR_OTHER_DIRECTORSHIPS).toBe('NIL');
  });

  it('maps resident director with PAN and India defaults', () => {
    const fields = buildDir2MergeFields({
      pre6: pre6Base,
      director: 'resident',
    });

    expect(fields.DIRECTOR_FULL_NAME).toBe('Priya Sharma');
    expect(fields.FATHERS_NAME).toBe('Raj Sharma');
    expect(fields.DIRECTOR_PAN).toBe('ABCDE1234F');
    expect(fields.DIRECTOR_NATIONALITY).toBe('India');
    expect(fields.DOCUMENT_PLACE).toBe('India');
    expect(fields.IDENTITY_PROOF).toBe('Copy of Aadhaar Card');
    expect(fields.RESIDENCE_PROOF).toBe('Copy of Electricity');
  });

  it('applies overrides', () => {
    const fields = buildDir2MergeFields({
      pre6: pre6Base,
      director: 'non-resident',
      overrides: { FATHERS_NAME: 'Xiao Ming Hsu', DIRECTOR_DIN: '12345678' },
    });

    expect(fields.FATHERS_NAME).toBe('Xiao Ming Hsu');
    expect(fields.DIRECTOR_DIN).toBe('12345678');
  });
});
