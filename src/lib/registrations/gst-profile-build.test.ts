import { describe, expect, it } from 'vitest';
import { director, fullState } from '@/lib/doc-pack/__tests__/fixtures';
import type { EngagementChecklistState } from '@/lib/projects/engagements-db';
import { buildGstProfile, flattenGstProfile, parseCodes, splitName, tenDigitMobile, type GstBuildInput } from './gst-profile-build';
import { GST_FORM_ID, isGstDocumentKey, isGstSourceField } from './gst-profile';
import { gstClientRequestItems, gstReadinessView } from './gst-readiness';

/** Obviously fake data only: the repo is public. */
const D1 = director('d1', 'yes', 'Asha', { gender: 'female', din: '01234567', recentPhotographUrl: 'eng-1/recentPhotographUrl/1700000000000-asha.jpg' });
const D2 = director('d2', 'yes', 'Ravi', { gender: 'male', fatherName: 'Mohan Lal Rao', recentPhotographUrl: 'eng-1/recentPhotographUrl/1700000000002-ravi.jpg' });
const D2_NO_PHOTO = director('d2', 'yes', 'Ravi', { gender: 'male' });

function stateWith(extra: Partial<EngagementChecklistState> = {}): EngagementChecklistState {
  return {
    ...fullState([D1, D2]),
    'pre-12': {
      status: 'completed',
      responses: {
        incorporatedCompanyName: 'Test Company Private Limited',
        dateOfIncorporation: '2026-11-02',
        cin: 'U62099KA2026PTC000001',
        pan: 'aaatc1234x',
        certificateOfIncorporationFinalUrl: 'eng-1/certificateOfIncorporationFinalUrl/1700000000001-coi.pdf',
      },
    },
    ...extra,
  } as EngagementChecklistState;
}

const READY_CLIENT = {
  district: 'Bengaluru Urban',
  reason: 'voluntary',
  possession: 'rented',
  activities: 'office, supplier of services',
  sac: '998314 - IT design and development, 998313',
  'aadhaar-opt-in': 'yes',
};

function input(over: Partial<GstBuildInput> = {}): GstBuildInput {
  return {
    engagement: { id: 'eng-1', slug: 'test-company', companyName: 'Test Company Private Limited', entityLegalForm: 'company', incorporationDate: '2026-11-02' },
    state: stateWith(),
    client: READY_CLIENT,
    sbc: { 'jurisdiction-sector': 'Sector 5', 'centre-commissionerate': 'Bengaluru East' },
    requestFiles: [
      { label: 'Rent agreement', fileName: 'rent.pdf', contentType: 'application/pdf', sizeBytes: 2048, objectKey: 'engagement-documents/eng-1/rent.pdf', source: 'request' },
      { label: 'NOC from the owner', fileName: 'noc.pdf', contentType: 'application/pdf', sizeBytes: 1024, objectKey: 'engagement-documents/eng-1/noc.pdf', source: 'request' },
      { label: 'Board resolution for GST signatory', fileName: 'br.pdf', contentType: 'application/pdf', sizeBytes: 999, objectKey: 'engagement-documents/eng-1/br.pdf', source: 'request' },
    ],
    ...over,
  };
}

describe('helpers', () => {
  it('splits names, reads Indian mobiles and parses codes', () => {
    expect(splitName('Mohan Lal Rao')).toEqual({ first: 'Mohan', middle: 'Lal', last: 'Rao' });
    expect(splitName('Mohan')).toEqual({ first: 'Mohan' });
    expect(tenDigitMobile('+91 9999999999')).toBe('9999999999');
    expect(tenDigitMobile('919876543210')).toBe('9876543210');
    expect(tenDigitMobile('+65 91234567')).toBeUndefined();
    expect(tenDigitMobile('12345')).toBeUndefined();
    expect(parseCodes('998314 - IT design; 998313, 998314, nope')).toEqual([{ code: '998314', description: 'IT design' }, { code: '998313' }]);
  });
});

describe('buildGstProfile', () => {
  it('fills Part A, the business, the promoters and the place from the tool', () => {
    const r = buildGstProfile(input());
    expect(r.form).toBe(GST_FORM_ID);
    expect(r.profile.partA).toEqual({
      applicantType: 'Taxpayer',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      legalName: 'Test Company Private Limited',
      pan: 'AAATC1234X',
      email: 'director@example.test',
      mobile: '9999999999',
    });
    expect(r.profile.business).toMatchObject({
      tradeName: 'Test Company Private Limited',
      constitution: 'Private Limited Company',
      commencementDate: '02/11/2026',
      reason: 'Voluntary Basis',
      cin: 'U62099KA2026PTC000001',
      compositionOpted: false,
      jurisdiction: { type: 'state', stateDistrict: 'Bengaluru Urban', sector: 'Sector 5', commissionerate: 'Bengaluru East' },
    });
    expect(r.profile.existingRegistrations).toEqual([
      { type: 'Corporate Identity Number/Foreign Company Registration Number', number: 'U62099KA2026PTC000001', date: '02/11/2026' },
    ]);
    const [asha, ravi] = r.profile.promoters;
    expect(asha).toMatchObject({ index: 1, firstName: 'Asha', lastName: 'Director', gender: 'Female', dob: '01/01/1980', din: '01234567', pan: 'ABCDE1234F', citizenOfIndia: true, aadhaarLast4: '9999', aadhaarOnFile: true, photo: 'promoter.1.photo', isPrimarySignatory: true });
    expect(ravi).toMatchObject({ fatherFirstName: 'Mohan', fatherMiddleName: 'Lal', fatherLastName: 'Rao' });
    expect(r.profile.signatory).toMatchObject({
      promoterIndex: 1,
      firstName: 'Asha',
      isPrimarySignatory: true,
      proofOfAppointment: 'signatory.proof',
      proofDocType: 'Copy of resolution passed by BoD / Managing Committee',
    });
    expect(r.profile.business.constitutionProofType).toBe('Certificate of Incorporation');
    expect(r.profile.meta).toEqual({ subjectKind: 'registration', subjectKey: 'reg-4', additionalPlacesCount: 0 });
    expect(r.profile.principalPlace).toMatchObject({
      address: { full: '2 Office Lane, Test City, 560001', pincode: '560001', state: 'Karnataka', district: 'Bengaluru Urban', country: 'India' },
      possession: 'Rented/Leased',
      proofDocType: 'Rent / Lease agreement',
      proofDocument: 'place.proof',
      nocDocument: 'place.noc',
      activities: ['Office / Sale Office', 'Supplier of Services'],
      hasAdditionalPlaces: false,
    });
    expect(r.profile.services).toEqual([{ sac: '998314', description: 'IT design and development' }, { sac: '998313' }]);
    expect(r.profile.aadhaar).toEqual({ optIn: true, persons: [1, 2] });
  });

  it('never carries a full Aadhaar number anywhere in the payload', () => {
    const r = buildGstProfile(input());
    expect(JSON.stringify(r)).not.toContain('999999999999');
  });

  it('is ready when every required value and document is held', () => {
    const r = buildGstProfile(input());
    expect(r.missing.filter((m) => m.required)).toEqual([]);
    expect(r.readiness).toEqual({ ready: true, missingValues: 0, missingDocuments: 0 });
    // Optional gaps stay listed, never blocking.
    expect(r.missing.find((m) => m.key === 'bank')?.required).toBe(false);
  });

  it('lists what is missing with where to get it, and omits it from the profile', () => {
    const base = fullState([D1, D2_NO_PHOTO]);
    const state = { ...base, 'pre-12': { status: 'not-started', responses: {} } } as EngagementChecklistState;
    const r = buildGstProfile(input({ state, client: {}, sbc: {}, requestFiles: [] }));
    const by = (key: string) => r.missing.find((m) => m.key === key);
    expect(r.readiness.ready).toBe(false);
    expect(r.profile.partA.pan).toBeUndefined();
    expect(by('partA.pan')).toMatchObject({ source: 'sharepoint', stepId: 'pre-12', required: true });
    expect(by('company.coi')).toMatchObject({ kind: 'document', source: 'sharepoint' });
    expect(by('partA.district')).toMatchObject({ source: 'client', stepId: 'reg-4' });
    expect(by('business.reason')).toMatchObject({ source: 'client' });
    expect(by('principalPlace.possession')).toMatchObject({ source: 'client' });
    expect(by('services')).toMatchObject({ source: 'client' });
    expect(by('signatory.proof')).toMatchObject({ kind: 'document', source: 'client' });
    expect(by('promoter.2.photo')).toMatchObject({ kind: 'document', source: 'sharepoint', stepId: 'pre-15' });
    expect(by('business.jurisdiction.sector')).toMatchObject({ source: 'portal', required: false });
    expect(r.readiness.missingDocuments).toBeGreaterThan(0);
  });

  it('reads a vault paper when the GST step has none, and an unmapped value is missing with a reason', () => {
    const r = buildGstProfile(
      input({
        client: { ...READY_CLIENT, possession: 'squatting', reason: 'because' },
        requestFiles: [{ label: 'Contracts: lease deed.pdf', fileName: 'lease deed.pdf', contentType: null, sizeBytes: null, objectKey: 'k', source: 'vault' }],
      }),
    );
    expect(r.documents.find((d) => d.key === 'place.proof')).toMatchObject({ source: 'vault', contentType: 'application/pdf' });
    expect(r.missing.find((m) => m.key === 'principalPlace.possession')?.reason).toBe('no GST portal equivalent mapped');
    expect(r.missing.find((m) => m.key === 'business.reason')?.reason).toBe('no GST portal equivalent mapped');
    expect(r.profile.business.reason).toBeUndefined();
  });

  it('uses the signatory the lead chose', () => {
    const r = buildGstProfile(input({ sbc: { signatory: '2' } }));
    expect(r.profile.signatory?.promoterIndex).toBe(2);
    expect(r.profile.promoters[1]?.isPrimarySignatory).toBe(true);
    expect(r.profile.promoters[0]?.isPrimarySignatory).toBeUndefined();
    expect(r.profile.aadhaar.persons[0]).toBe(2);
  });

  it('flattens to sourceField keys that are all in the vocabulary', () => {
    const r = buildGstProfile(input({ client: { ...READY_CLIENT, 'additional-places': 'Plot 9, Second Road, Test Town 560002', hsn: '8471 Laptops', 'bank-account': '0001 2345 678', 'bank-ifsc': 'test0001234' } }));
    const keys = Object.keys(r.fields);
    expect(keys.filter((k) => !isGstSourceField(k))).toEqual([]);
    expect(r.fields['promoters.2.firstName']).toBe('Ravi');
    expect(r.fields['principalPlace.activities']).toBe('Office / Sale Office; Supplier of Services');
    expect(r.fields['additionalPlaces.1.address.pincode']).toBe('560002');
    expect(r.fields['goods.1.hsn']).toBe('8471');
    expect(r.fields['bank.ifsc']).toBe('TEST0001234');
    expect(r.fields['aadhaar.optIn']).toBe(true);
    expect(r.documents.map((d) => d.key).filter((k) => !isGstDocumentKey(k))).toEqual([]);
    expect(flattenGstProfile(r.profile)).toEqual(r.fields);
  });
});

describe('live portal vocabulary (requested by the extension, 25 Nov 2026)', () => {
  it.each([
    ['owned', 'Owned', 'Electricity Bill', false],
    ['leased', 'Rented/Leased', 'Rent / Lease agreement', true],
    ['consent', 'Consent Based', 'Consent Letter', true],
    ['co-working', 'Co-working Space', 'Membership Agreement', false],
  ])('%s premises', (typed, label, proof, needsNoc) => {
    const r = buildGstProfile(input({ client: { ...READY_CLIENT, possession: typed }, requestFiles: [] }));
    expect(r.profile.principalPlace.possession).toBe(label);
    expect(r.profile.principalPlace.proofDocType).toBe(proof);
    expect(Boolean(r.missing.find((m) => m.key === 'place.noc'))).toBe(needsNoc);
  });

  it('a letter of authorisation and the additional places count', () => {
    const r = buildGstProfile(
      input({
        client: { ...READY_CLIENT, 'additional-places': 'Plot 9, Test Town 560002\nUnit 4, Test City 560003' },
        requestFiles: [{ label: 'Letter of authority for the signatory', fileName: 'letter.pdf', contentType: 'application/pdf', sizeBytes: 1, objectKey: 'k', source: 'request' }],
      }),
    );
    expect(r.profile.signatory?.proofDocType).toBe('Letter of Authorisation');
    expect(r.fields['meta.additionalPlacesCount']).toBe(2);
    expect(r.fields['signatory.isPrimarySignatory']).toBe(true);
    expect(r.fields['meta.subjectKey']).toBe('reg-4');
  });
});

describe('readiness', () => {
  it('a ready application offers the portal and no sourcing', () => {
    const v = gstReadinessView(buildGstProfile(input()));
    expect(v.ready).toBe(true);
    expect(v.actions).toEqual(['start_portal', 'open_step']);
    expect(v.line).toMatch(/ready for GST registration/);
  });

  it('an application with gaps offers SharePoint and the client, in the chain order', () => {
    const r = buildGstProfile(input({ client: {}, requestFiles: [] }));
    const v = gstReadinessView(r, { zohoLinked: true });
    expect(v.ready).toBe(false);
    expect(v.actions).toEqual(['fetch_sharepoint', 'ask_client', 'open_step']);
    expect(v.line).toMatch(/not ready/);
    expect(v.line).toMatch(/Zoho/);
    expect(v.gaps.length).toBeLessThanOrEqual(8);
    expect(v.gapCount).toBe(r.missing.filter((m) => m.required).length);
  });

  it('the client request list carries only what the client or their papers give', () => {
    const r = buildGstProfile(input({ client: {}, requestFiles: [] }));
    const items = gstClientRequestItems(r.missing);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.kind === 'answer' || i.kind === 'document')).toBe(true);
    expect(items.some((i) => /jurisdiction/i.test(i.label))).toBe(false);
    expect(items.find((i) => /Board resolution/.test(i.label))?.kind).toBe('document');
  });
});
