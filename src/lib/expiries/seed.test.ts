import { describe, expect, it } from 'vitest';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import type { RegistrationFacts } from '@/lib/registrations/registration-facts';
import { seedRowsFor } from './seed';

const slice = (responses: Record<string, string>): ChecklistItemStateSlice => ({ status: 'in-progress', responses });

const STATE = {
  'pre-15': slice({
    directors: 'e1,e2',
    'directors.e1.firstName': 'Ravi',
    'directors.e1.lastName': 'Kumar',
    'directors.e1.din': '01234567',
    'directors.e1.hasDsc': 'yes',
    'directors.e1.dscExpiryDate': '2027-03-12',
    'directors.e2.firstName': 'Asha',
    'directors.e2.lastName': 'Rao',
    'directors.e2.hasDsc': 'no',
  }),
};

function facts(stepId: string, f: Partial<RegistrationFacts>): RegistrationFacts {
  return { stepId, rowKey: stepId, number: null, registeredOn: null, certificate: null, issuedOn: null, expiresOn: null, renewEveryMonths: null, ...f };
}

describe('seedRowsFor', () => {
  it('adds a DSC for each director with a DSC expiry, and DIR-3 KYC for each DIN holder', () => {
    const rows = seedRowsFor({ companyName: 'Acme Private Limited', state: STATE, registrationFacts: {}, directors: [], today: '2026-11-09', incorporated: true });
    expect(rows).toEqual([
      expect.objectContaining({ kind: 'dsc', subjectName: 'Ravi Kumar', expiresOn: '2027-03-12', sourceKey: 'dsc:ravi-kumar', referenceLabel: 'DIN 01234567', sync: true }),
      expect.objectContaining({ kind: 'dir3_kyc', subjectName: 'Ravi Kumar', expiresOn: '2027-09-30', sourceKey: 'dir3:01234567', sync: false }),
    ]);
  });

  it('adds the DSC the firm made on KYC Review & DSC (pre-7), which replaces an older one', () => {
    const state = {
      'pre-15': slice({
        ...STATE['pre-15'].responses,
        'directors.e1.indiaResident': 'yes',
        'directors.e2.indiaResident': 'yes',
      }),
      'pre-7': slice({ residentDirectorDscExpiryDate: '2028-11-10', residentDirector2DscExpiryDate: '2028-11-12' }),
    };
    const rows = seedRowsFor({ companyName: 'Acme', state, registrationFacts: {}, directors: [], today: '2026-11-09' });
    expect(rows.filter((r) => r.kind === 'dsc').map((r) => [r.subjectName, r.expiresOn, r.sourceKey])).toEqual([
      ['Ravi Kumar', '2028-11-10', 'dsc:ravi-kumar'],
      ['Asha Rao', '2028-11-12', 'dsc:asha-rao'],
    ]);
  });

  it('takes DIN holders from the current directors, skips ceased ones and deduplicates by DIN', () => {
    const rows = seedRowsFor({
      companyName: 'Acme',
      state: STATE,
      registrationFacts: {},
      directors: [
        { name: 'Ravi K', din: '01234567', ceasedOn: null },
        { name: 'Old Director', din: '07654321', ceasedOn: '2026-01-01' },
        { name: 'New Director', din: '08888888', ceasedOn: null },
      ],
      today: '2026-08-01',
      incorporated: true,
    });
    const kyc = rows.filter((r) => r.kind === 'dir3_kyc');
    expect(kyc.map((r) => [r.subjectName, r.expiresOn])).toEqual([
      ['Ravi K', '2026-09-30'],
      ['New Director', '2026-09-30'],
    ]);
  });

  it('adds no DIR-3 KYC before the company is incorporated, and the DSCs as before', () => {
    const rows = seedRowsFor({
      companyName: 'Acme',
      state: STATE,
      registrationFacts: {},
      directors: [{ name: 'New Director', din: '08888888', ceasedOn: null }],
      today: '2026-08-01',
      incorporated: false,
    });
    expect(rows.filter((r) => r.kind === 'dir3_kyc')).toEqual([]);
    expect(rows.map((r) => r.kind)).toEqual(['dsc']);
  });

  it('dates a DIN allotted at incorporation from 30 September of the next financial year', () => {
    const state = {
      'pre-15': slice({
        ...STATE['pre-15'].responses,
        'directors.e1.hasDin': 'yes',
        'directors.e2.hasDin': 'no',
      }),
    };
    // Asha Rao had no DIN, so SPICe+ allotted one on the incorporation date (10 June 2026, FY 2026-27).
    const directors = [
      { name: 'Ravi Kumar', din: '01234567', ceasedOn: null },
      { name: 'Asha Rao', din: '09999999', ceasedOn: null },
    ];
    const rows = seedRowsFor({ companyName: 'Acme', state, registrationFacts: {}, directors, today: '2026-08-01', incorporated: true, incorporationDate: '2026-06-10' });
    expect(rows.filter((r) => r.kind === 'dir3_kyc').map((r) => [r.subjectName, r.expiresOn, Boolean(r.raiseOnly)])).toEqual([
      // A director who already had a DIN keeps the yearly 30 September.
      ['Ravi Kumar', '2026-09-30', false],
      ['Asha Rao', '2027-09-30', true],
    ]);
    // Incorporated in February 2026 (FY 2025-26): first due on 30 September 2026.
    const feb = seedRowsFor({ companyName: 'Acme', state, registrationFacts: {}, directors, today: '2026-08-01', incorporated: true, incorporationDate: '2026-02-10' });
    expect(feb.find((r) => r.subjectName === 'Asha Rao' && r.kind === 'dir3_kyc')?.expiresOn).toBe('2026-09-30');
  });

  it('adds registrations that carry an expiry, and LEI a year on from its registration date', () => {
    const rows = seedRowsFor({
      companyName: 'Acme',
      state: {},
      registrationFacts: {
        'reg-9': facts('reg-9', { expiresOn: '2027-01-31', number: 'SE-123' }),
        'reg-4': facts('reg-4', { number: '36AAACX1234F1Z5' }),
        'reg-6': facts('reg-6', { registeredOn: '2025-12-01' }),
        'reg-12': facts('reg-12', { expiresOn: '2030-05-01' }),
      },
      directors: [],
      today: '2026-11-09',
    });
    expect(rows.map((r) => [r.kind, r.expiresOn, r.sourceKey])).toEqual([
      ['shops', '2027-01-31', 'reg:reg-9'],
      ['lei', '2026-12-01', 'reg:reg-6'],
      ['other', '2030-05-01', 'reg:reg-12'],
    ]);
    expect(rows[0]).toMatchObject({ subjectKind: 'company', subjectName: 'Acme', referenceLabel: 'Shops & Establishment SE-123', source: 'registration' });
  });

  it('adds the authorised signatory DSC typed on PF and ICEGATE, merged with a director of the same name', () => {
    const state = {
      ...STATE,
      'reg-1': slice({ signatoryDscHolderName: 'Asha Rao', signatoryDscExpiryDate: '2028-01-15' }),
      'reg-16': slice({ signatoryDscExpiryDate: '2027-06-30' }),
    };
    const rows = seedRowsFor({ companyName: 'Acme', state, registrationFacts: {}, directors: [], today: '2026-11-09' });
    expect(rows.filter((r) => r.kind === 'dsc').map((r) => [r.subjectName, r.expiresOn])).toEqual([
      ['Ravi Kumar', '2027-03-12'],
      ['Asha Rao', '2028-01-15'],
      ['Authorised signatory', '2027-06-30'],
    ]);
  });

  it('shows the name approval until Part B is filed or the company is incorporated', () => {
    const state = { 'pre-5': slice({ approvedCompanyName: 'Acme Private Limited', nameApprovalExpiryDate: '2026-11-30' }) };
    const open = seedRowsFor({ companyName: 'Acme', state, registrationFacts: {}, directors: [], today: '2026-11-09' });
    expect(open).toEqual([
      expect.objectContaining({ kind: 'name_approval', subjectKind: 'company', expiresOn: '2026-11-30', sourceKey: 'name:pre-5', referenceLabel: 'File SPICe+ Part B for Acme Private Limited before this date' }),
    ]);
    const filed = { ...state, 'pre-10': { status: 'completed' as const, responses: {} } };
    expect(seedRowsFor({ companyName: 'Acme', state: filed, registrationFacts: {}, directors: [], today: '2026-11-09' })).toEqual([]);
    expect(seedRowsFor({ companyName: 'Acme', state, registrationFacts: {}, directors: [], today: '2026-11-09', incorporated: true })).toEqual([]);
  });

  it('lets a Trademark Renewal date replace the Trademark Registration one', () => {
    const rows = seedRowsFor({
      companyName: 'Acme',
      state: {},
      registrationFacts: { 'reg-12': facts('reg-12', { expiresOn: '2026-05-01' }), 'reg-17': facts('reg-17', { expiresOn: '2036-05-01' }) },
      directors: [],
      today: '2026-11-09',
    });
    expect(rows.map((r) => [r.sourceKey, r.expiresOn])).toEqual([['reg:reg-17', '2036-05-01']]);
  });
});
