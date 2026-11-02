import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import type { StatutoryDeadline } from '@/data/statutory-calendar-fy2627';
import { calendarFrequency, calendarName, calendarPeriod, calendarPeriodEnd, statutoryFilings } from './statutory-fallback';

const eng = (over: Partial<Engagement> = {}): Engagement =>
  ({ id: 'e1', companyName: 'Routeware', entityLegalForm: 'company', companyType: 'foreign', parentEntityName: 'Rootware Inc', ...over }) as Engagement;
const dl = (date: string, act: StatutoryDeadline['act'], title: string): StatutoryDeadline => ({ id: 'x', date, act, title });

describe('SBC compliance calendar as filing rows', () => {
  it('names, frequencies and periods read like the register', () => {
    expect(calendarName('GSTR-3B; GSTR-5A (OIDAR)')).toBe('GSTR-3B');
    expect(calendarFrequency('GSTR-1')).toBe('monthly');
    expect(calendarFrequency('TDS returns Q2 FY 2026-27')).toBe('quarterly');
    expect(calendarFrequency('Form MSME-1 (Apr – Sep ’26)')).toBe('half-yearly');
    expect(calendarFrequency('Filing of LUT (before export of services/goods)')).toBe('one-time');
    expect(calendarPeriod(dl('2026-11-20', 'GST', 'GSTR-3B'))).toBe('Oct 2026');
    expect(calendarPeriod(dl('2026-10-31', 'IT', 'TDS returns Q2 FY 2026-27'))).toBe('Jul–Sep 2026');
    expect(calendarPeriod(dl('2026-12-15', 'IT', 'Advance tax Q3'))).toBe('Oct–Dec 2026');
    expect(calendarPeriod(dl('2026-10-31', 'MCA', 'Form MSME-1 (Apr – Sep ’26)'))).toBe('Apr–Sep 2026');
    expect(calendarPeriod(dl('2026-11-30', 'IT', 'Income tax return (audit cases)'))).toBe('FY 2025-26');
  });

  it('keeps only deadlines from today to the end of the year that apply to the company, marked as calendar rows', () => {
    const rows = statutoryFilings(eng(), 2026, '2026-10-29');
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.every((r) => r.fromCalendar && r.dueDate >= '2026-10-29' && r.dueDate <= '2027-03-31')).toBe(true);
    expect(rows.every((r) => r.filedOn === null && r.reminderOn === null && r.proofCount === 0 && r.penaltyRisk === '')).toBe(true);
    // a foreign-parent company sees FEMA lines; an Indian company without a parent does not
    expect(rows.some((r) => r.area === 'FEMA')).toBe(true);
    expect(statutoryFilings(eng({ companyType: 'domestic' as never, parentEntityName: undefined }), 2026, '2026-10-29').some((r) => r.area === 'FEMA')).toBe(false);
    // RERA never applies; LLP forms only for an LLP
    expect(rows.some((r) => /RERA/.test(r.particular))).toBe(false);
    expect(rows.some((r) => /LLP Form/.test(r.particular))).toBe(false);
  });

  it('leaves out every line for a period that ended before the company existed', () => {
    expect(calendarPeriodEnd(dl('2026-11-20', 'GST', 'GSTR-3B'))).toBe('2026-10-31');
    expect(calendarPeriodEnd(dl('2026-10-31', 'IT', 'TDS return Q2'))).toBe('2026-09-30');
    expect(calendarPeriodEnd(dl('2026-12-15', 'IT', 'Advance tax Q3'))).toBe('2026-12-31');
    expect(calendarPeriodEnd(dl('2026-10-29', 'MCA', 'Form AOC-4'))).toBe('2026-03-31');
    // a line that names its year
    expect(calendarPeriodEnd(dl('2026-12-31', 'IT', 'Revised / belated ITR for AY 2026-27'))).toBe('2026-03-31');
    expect(calendarPeriodEnd(dl('2026-10-31', 'GST', 'Last date to claim ITC for FY 2025-26'))).toBe('2026-03-31');
    expect(calendarPeriodEnd(dl('2026-12-31', 'MCA', 'AGM for newly incorporated companies'))).toBe('2026-03-31');
    const rows = statutoryFilings(eng(), 2026, '2026-10-29', '2026-12-21');
    expect(rows.length).toBeGreaterThan(0);
    // incorporated on 21 Dec: nothing due before then, nothing for a period that ended before then
    expect(rows.every((r) => r.dueDate >= '2026-12-21')).toBe(true);
    expect(rows.some((r) => /AOC-4|27D Q2|MSME-1|Advance tax Q3|AY 2026-27|newly incorporated|FY 2025-26/.test(r.particular))).toBe(false);
  });

  it('is empty once the year is over', () => {
    expect(statutoryFilings(eng(), 2026, '2027-04-01')).toEqual([]);
  });
});
