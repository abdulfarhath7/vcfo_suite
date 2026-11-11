import { describe, expect, it } from 'vitest';
import { LUT_FIELD, financialYearOf, lutNotice, lutStages, lutValidTill } from './lut-tracker';

describe('LUT dates', () => {
  it('works out the financial year from a date', () => {
    expect(financialYearOf('2026-11-18')).toBe('2026-27');
    expect(financialYearOf('2027-03-31')).toBe('2026-27');
    expect(financialYearOf('2027-04-01')).toBe('2027-28');
    expect(financialYearOf('')).toBeNull();
  });

  it('is valid to the end of the financial year', () => {
    expect(lutValidTill('2026-27')).toBe('2027-03-31');
    expect(lutValidTill(null)).toBeNull();
  });
});

describe('lutStages', () => {
  it('moves from filing to allotted', () => {
    expect(lutStages({}).map((s) => s.state)).toEqual(['current', 'upcoming']);
    expect(lutStages({ [LUT_FIELD.filedOn]: '2026-11-18' }).map((s) => s.state)).toEqual(['done', 'current']);
    expect(lutStages({ [LUT_FIELD.filedOn]: '2026-11-18', [LUT_FIELD.number]: 'AD29' }).map((s) => s.state)).toEqual(['done', 'done']);
  });
});

describe('lutNotice', () => {
  const day = { date: '2026-11-18', source: 'calendar' as const };

  it('follows the GST registration day', () => {
    expect(lutNotice(day, {}, '2026-11-10')?.text).toBe('The LUT is scheduled for 18 Nov 2026, the GST registration day.');
    expect(lutNotice(day, {}, '2026-11-18')?.tone).toBe('warning');
    expect(lutNotice(day, {}, '2026-11-19')?.tone).toBe('danger');
    expect(lutNotice({ date: '2026-10-15', source: 'deadline' }, {}, '2026-10-10')?.text).toMatch(/Schedule that day on the firm calendar/);
  });

  it('shows the validity once the number is recorded', () => {
    expect(lutNotice(day, { [LUT_FIELD.filedOn]: '2026-11-18', [LUT_FIELD.number]: 'AD2911260012345' }, '2026-11-20')?.text).toBe(
      'LUT AD2911260012345 is valid until 31 Mar 2027.',
    );
  });

  it('gives the client facts without instructions', () => {
    expect(lutNotice(day, {}, '2026-11-18', 'client')?.text).toBe('The LUT is scheduled for today.');
    expect(lutNotice(day, { [LUT_FIELD.filedOn]: '2026-11-18' }, '2026-11-19', 'client')).toBeNull();
  });
});
