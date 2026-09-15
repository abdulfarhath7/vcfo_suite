import { describe, expect, it } from 'vitest';
import { getItem } from '@/data/checklist';
import { validatePre1Responses } from '@/lib/checklist-pre1-validation';
import { fieldsForOwnership, getClientResponseFields } from '@/lib/checklist-responses';
import { createProjectBodySchema } from '@/lib/api/schemas';

const pre1 = getItem('pre-1')!;

describe('fieldsForOwnership', () => {
  it('drops the parent-entity sections and board resolution date for an independent company', () => {
    const all = getClientResponseFields(pre1);
    const independent = fieldsForOwnership('pre-1', all, 'independent');
    const gone = new Set(all.filter((f) => !independent.includes(f)).map((f) => f.id));
    for (const id of [
      'parentEntityName',
      'parentEntityRegistrationNumber',
      'parentEntityAddress',
      'parentEntityHasTrademark',
      'certificateOfIncorporationUrl',
      'signatoryFirstName',
      'passportUrl',
      'boardResolutionDate',
    ]) {
      expect(gone.has(id), id).toBe(true);
    }
    for (const id of ['proposedName1', 'director1FirstName', 'authorisedShareCapital', 'businessDescription']) {
      expect(independent.some((f) => f.id === id), id).toBe(true);
    }
  });

  it('leaves a dependent company and every other step untouched', () => {
    const all = getClientResponseFields(pre1);
    expect(fieldsForOwnership('pre-1', all, 'subsidiary')).toBe(all);
    expect(fieldsForOwnership('pre-1', all, undefined)).toBe(all);
    const pre6 = getClientResponseFields(getItem('pre-6')!);
    expect(fieldsForOwnership('pre-6', pre6, 'independent')).toBe(pre6);
  });
});

describe('validatePre1Responses for an independent company', () => {
  const filled = {
    proposedName1: 'Acme India Private Limited',
    proposedName2: 'Acme Tech India Private Limited',
    companyMailId: 'ops@acme.in',
    companyMobileCountryCode: '+91',
    companyMobileNumber: '9876543210',
    businessDescription: 'Software',
    directorCount: '2',
    director1FirstName: 'A',
    director1LastName: 'B',
    director1Gender: 'male',
    director1IndiaResident: 'yes',
    director2FirstName: 'C',
    director2LastName: 'D',
    director2Gender: 'female',
    director2IndiaResident: 'no',
    authorisedShareCapital: '1000000',
    paidUpShareCapital: '100000',
    nominalValuePerEquityShare: '10',
  };

  it('does not require parent, signatory, KYC uploads or the board resolution date', () => {
    expect(validatePre1Responses(filled).ok).toBe(false);
    expect(validatePre1Responses(filled, { independent: true }).ok).toBe(true);
  });
});

describe('createProjectBodySchema ownership', () => {
  const base = {
    companyName: 'Acme',
    companyType: 'domestic',
    clientEmail: 'founder@acme.in',
    clientPassword: 'SBC@2026',
    internId: 'intern-1',
    managerId: '00000000-0000-4000-8000-000000000000',
  };

  it('defaults to a dependent company and then requires parent details', () => {
    const result = createProjectBodySchema.safeParse(base);
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('parentEntityName');
    expect(paths).toContain('parentEntityAddress');
  });

  it('lets an independent company skip parent and subsidiary details at any stage', () => {
    const result = createProjectBodySchema.safeParse({
      ...base,
      ownershipType: 'independent',
      stage: 'Post-Incorporation',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.parentEntityName).toBe('');
  });
});
