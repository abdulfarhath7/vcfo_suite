import { describe, expect, it } from 'vitest';
import { hasDirectorRecord, normalizeDinResponse } from './normalize';
import { isValidDin } from './validate';

const falconSample = {
  din: '08123456',
  name: 'RAMESH KUMAR',
  din_status: 'Approved',
  approve_date: '2018-04-12',
  dir3_kyc: 'Done',
  updated_at: '2026-01-20 17:37:31',
  association: [
    { cin: 'U74999TG2019PTC130001', com_name: 'STEADFAST ADVISORS PRIVATE LIMITED', designation: 'Director', appointment: '2019-06-01', entity_type: 'company' },
    { cin: 'AAB-1234', com_name: 'STEADFAST LLP', designation: 'Designated Partner', appointment: '2021-02-15', entity_type: 'llp' },
  ],
};

describe('isValidDin', () => {
  it('takes eight digits only', () => {
    expect(isValidDin('08123456')).toBe(true);
    expect(isValidDin(' 08123456 ')).toBe(true);
    expect(isValidDin('8123456')).toBe(false);
    expect(isValidDin('081234567')).toBe(false);
    expect(isValidDin('0812345A')).toBe(false);
  });
});

describe('normalizeDinResponse', () => {
  it('reads the documented FalconeBiz shape', () => {
    const data = normalizeDinResponse(falconSample, '08123456');
    expect(data.din).toBe('08123456');
    expect(data.name).toBe('RAMESH KUMAR');
    expect(data.dinStatus).toBe('Approved');
    expect(data.approveDate).toBe('2018-04-12');
    expect(data.dir3Kyc).toBe('Done');
    expect(data.associations).toHaveLength(2);
    expect(hasDirectorRecord(data)).toBe(true);
  });

  it('puts the newest appointment first', () => {
    const data = normalizeDinResponse(falconSample, '08123456');
    expect(data.associations.map((a) => a.appointmentDate)).toEqual(['2021-02-15', '2019-06-01']);
  });

  it('converts DD/MM/YYYY dates and infers the entity type from the number', () => {
    const data = normalizeDinResponse(
      {
        din: '08123456',
        name: 'A',
        approve_date: '12/04/2018',
        association: [{ cin: 'AAC-9999', com_name: 'SOME LLP', appointment: '15/02/2021' }],
      },
      '08123456',
    );
    expect(data.approveDate).toBe('2018-04-12');
    expect(data.associations[0]).toMatchObject({ entityType: 'llp', appointmentDate: '2021-02-15' });
  });

  it('unwraps a data envelope and drops empty association rows', () => {
    const data = normalizeDinResponse({ data: { ...falconSample, association: [...falconSample.association, {}] } }, '08123456');
    expect(data.name).toBe('RAMESH KUMAR');
    expect(data.associations).toHaveLength(2);
  });

  it('drops a repeated association row', () => {
    const row = falconSample.association[0];
    const data = normalizeDinResponse({ ...falconSample, association: [row, { ...row }] }, '08123456');
    expect(data.associations).toHaveLength(1);
  });

  it('reports an unknown DIN as having no record', () => {
    const data = normalizeDinResponse({}, '08123456');
    expect(data.din).toBe('08123456');
    expect(hasDirectorRecord(data)).toBe(false);
  });
});
