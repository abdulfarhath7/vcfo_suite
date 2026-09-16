import { describe, expect, it } from 'vitest';
import { validatePre15Responses } from '@/lib/checklist-part-b-validation';
import {
  directorResponsesFromState,
  directorsAsPre6Responses,
  readProposedDirectors,
} from '@/lib/proposed-directors';

const resident = {
  firstName: 'Asha', lastName: 'Rao', gender: 'female', indiaResident: 'yes', dob: '1985-04-02',
  fatherName: 'R Rao', highestEducationalQualification: 'bachelors-degree', occupationType: 'business',
  mobileNumber: '+919876543210', personalMailId: 'asha@example.com', aadhaarNumber: '123412341234',
  aadhaarCopyUrl: 'e/aadhaar/1-a.pdf', panNumber: 'ABCDE1234F', panCopyUrl: 'e/pan/1-p.pdf',
  utilityBillType: 'electricity', utilityBillNumber: '77', utilityBillAddress: '1 MG Road', utilityBillCopyUrl: 'e/ub/1-u.pdf',
  recentPhotographUrl: 'e/photo/1-x.jpg', hasOtherCompanyInterest: 'no',
};
const nonResident = {
  ...resident, firstName: 'John', lastName: 'Doe', gender: 'male', indiaResident: 'no', aadhaarNumber: '', aadhaarCopyUrl: '',
  panNumber: '', panCopyUrl: '', passportNumber: 'X1234567', passportCopyUrl: 'e/pp/1-p.pdf', notaryApostilleMethod: 'consultant',
};
function entries(list: Record<string, string>[]): Record<string, string> {
  const out: Record<string, string> = { directors: list.map((_, i) => `e${i + 1}`).join(',') };
  list.forEach((values, i) => {
    for (const [k, v] of Object.entries(values)) if (v) out[`directors.e${i + 1}.${k}`] = v;
  });
  return out;
}

describe('proposed directors accessor', () => {
  it('reads pre-15 entries first', () => {
    const state = { 'pre-15': { status: 'in-progress' as const, responses: entries([resident, nonResident]) } };
    const directors = readProposedDirectors(state);
    expect(directors.map((d) => d.values.firstName)).toEqual(['Asha', 'John']);
    const { pre1, pre6 } = directorResponsesFromState(state);
    expect(pre1.directorCount).toBe('2');
    expect(pre1.director1FirstName).toBe('Asha');
    expect(pre1.director2IndiaResident).toBe('no');
    expect(pre6.residentDirectorFirstName).toBe('Asha');
    expect(pre6.residentDirectorPanNumber).toBe('ABCDE1234F');
    expect(pre6.nrDirectorPassportNumber).toBe('X1234567');
    expect(pre6.nrDirectorNotaryApostilleMethod).toBe('consultant');
  });

  it('falls back to the legacy Part A slots + Director KYC step, matched by residency', () => {
    const state = {
      'pre-1': {
        status: 'completed' as const,
        responses: {
          directorCount: '2', director1FirstName: 'Asha', director1LastName: 'Rao', director1Gender: 'female', director1IndiaResident: 'yes',
          director2FirstName: 'John', director2LastName: 'Doe', director2Gender: 'male', director2IndiaResident: 'no', director2Din: '01234567',
        },
      },
      'pre-6': { status: 'completed' as const, responses: { residentDirectorPanNumber: 'ABCDE1234F', nrDirectorPassportNumber: 'X1234567', nrDirector2PassportNumber: 'NOPE' } },
    };
    const directors = readProposedDirectors(state);
    expect(directors.map((d) => d.values.firstName)).toEqual(['Asha', 'John']);
    expect(directors[0]?.values.panNumber).toBe('ABCDE1234F');
    expect(directors[1]?.values.passportNumber).toBe('X1234567');
    expect(directors[1]?.values.din).toBe('01234567');
    // Legacy maps are handed through untouched.
    const { pre6 } = directorResponsesFromState(state);
    expect(pre6.nrDirector2PassportNumber).toBe('NOPE');
  });

  it('numbers extra directors of the same residency the way the legacy step did', () => {
    const pre6 = directorsAsPre6Responses([
      { id: 'a', index: 1, values: { firstName: 'A', indiaResident: 'yes' } },
      { id: 'b', index: 2, values: { firstName: 'B', indiaResident: 'yes' } },
      { id: 'c', index: 3, values: { firstName: 'C', indiaResident: 'no' } },
    ]);
    expect(pre6.residentDirectorFirstName).toBe('A');
    expect(pre6.residentDirector2FirstName).toBe('B');
    expect(pre6.nrDirectorFirstName).toBe('C');
  });
});

describe('validatePre15Responses', () => {
  it('needs two directors, one resident in India, each complete', () => {
    expect(validatePre15Responses({}).errors.directors).toMatch(/at least 2/i);
    expect(validatePre15Responses(entries([nonResident, nonResident])).errors.directors).toMatch(/resident of India/);
    const ok = validatePre15Responses(entries([resident, nonResident]));
    expect(ok.errors).toEqual({});
    const bad = validatePre15Responses(entries([{ ...resident, panNumber: 'nope', personalMailId: 'x' }, nonResident]));
    expect(bad.errors['directors.e1.panNumber']).toMatch(/PAN/);
    expect(bad.errors['directors.e1.personalMailId']).toMatch(/e-mail/);
    const missing = validatePre15Responses(entries([{ ...resident, aadhaarCopyUrl: '' }, nonResident]));
    expect(missing.errors['directors.e1.aadhaarCopyUrl']).toMatch(/upload/);
    // A non-resident is not asked for Aadhaar.
    expect(missing.errors['directors.e2.aadhaarCopyUrl']).toBeUndefined();
  });
});
