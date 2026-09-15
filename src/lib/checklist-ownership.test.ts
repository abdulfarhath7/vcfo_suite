import { describe, expect, it } from 'vitest';
import { getItem } from '@/data/checklist';
import { validatePre1Responses } from '@/lib/checklist-pre1-validation';
import { fieldsForOwnership, getClientResponseFields } from '@/lib/checklist-responses';
import { partAFieldsFor, partAsectionsFor } from '@/lib/part-a-sections';
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
    expect(fieldsForOwnership('pre-1', all, 'subsidiary').map((f) => f.id)).toEqual(
      all.map((f) => f.id),
    );
    expect(fieldsForOwnership('pre-1', all, undefined).map((f) => f.id)).toEqual(
      all.map((f) => f.id),
    );
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
    const visibleFieldIds = new Set(
      partAFieldsFor(getClientResponseFields(pre1), 'independent').map((f) => f.id),
    );
    expect(validatePre1Responses(filled, { visibleFieldIds }).ok).toBe(true);
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

  it('defaults to a dependent company without demanding parent details at creation', () => {
    // The parent entity is captured in SPICe+ Part A, not on the project form.
    const result = createProjectBodySchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ownershipType).toBe('subsidiary');
      expect(result.data.parentEntityName).toBe('');
    }
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

describe('partAsectionsFor', () => {
  it('is the single source for the tab list: every pre-1 section appears once, in order', () => {
    const all = getClientResponseFields(pre1);
    const dependent = partAsectionsFor('subsidiary');
    const seen = new Set(all.map((f) => f.section).filter(Boolean));
    expect(new Set(dependent)).toEqual(seen);
    const independent = partAsectionsFor('independent');
    expect(independent).not.toContain('Signatory KYC');
    expect(independent).not.toContain('Authorized Signatory');
    expect(independent).not.toContain('Foreign Entity');
    expect(independent).not.toContain('Foreign Entity Proof');
    // Relative order of the shared sections is identical for both company types.
    expect(dependent.filter((s) => independent.includes(s))).toEqual(independent);
  });

  it('sorts fields by that order and keeps the remarks field last', () => {
    const fields = partAFieldsFor(getClientResponseFields(pre1), 'subsidiary');
    const order: readonly string[] = partAsectionsFor('subsidiary');
    let last = -1;
    for (const field of fields) {
      if (field.section === undefined) continue;
      const rank = order.indexOf(field.section);
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
    expect(fields[fields.length - 1]?.id).toBe('stepRemarks');
  });
});
