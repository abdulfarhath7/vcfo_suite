import { describe, expect, it } from 'vitest';
import { capturedDirectorSchema } from './capture';
import { currentAssociations, normalizeDinResponse, pastAssociations } from './normalize';

/**
 * The real MCA report, taken from "View Director / Designated Partner Details" for DIN
 * 06419899 (AMEERUDDIN SYED, read 25 November 2026). It holds the cases the API sample does
 * not: a struck-off company, a dash where there is no designation or category, one company
 * twice under two designations, and rows that have ceased.
 */
const MCA_REPORT = {
  din: '06419899',
  name: 'AMEERUDDIN SYED',
  association: [
    { cin: 'U72200TG2013PTC085185', com_name: 'TECHNICHE ITES PRIVATE LIMITED', company_status: 'Strike Off', designation: 'Director', appointment_category: 'Promoter', appointment: '01/01/2013', current_designation_date: '01/01/2013', cessation: '-' },
    { cin: 'U72900TG2010PTC066869', com_name: 'MOTIVITY LABS PRIVATE LIMITED', company_status: 'Active', designation: 'Director', appointment_category: 'Professional', appointment: '02/01/2020', current_designation_date: '02/01/2020', cessation: '-' },
    { cin: 'L72100TG1981PLC169991', com_name: 'MAGELLANIC CLOUD LIMITED', company_status: 'Active', designation: 'Whole-time director', appointment_category: 'Professional', appointment: '03/02/2026', current_designation_date: '03/02/2026', cessation: '-' },
    { cin: 'U65993TG1992PLC014157', com_name: 'PROVIGIL SURVEILLANCE LIMITED', company_status: 'Active', designation: 'Director', appointment_category: 'Professional', appointment: '10/10/2023', current_designation_date: '15/07/2024', cessation: '-' },
    { cin: 'U65993TG1992PLC014157', com_name: 'PROVIGIL SURVEILLANCE LIMITED', company_status: 'Active', designation: 'Additional Director', appointment_category: '-', appointment: '10/10/2023', current_designation_date: '-', cessation: '14/07/2024' },
    { cin: 'U72900TG2022PTC163495', com_name: 'ZILIKA TECHNOLOGIES PRIVATE LIMITED', company_status: 'Active', designation: 'Director', appointment_category: '-', appointment: '08/06/2022', current_designation_date: '-', cessation: '23/09/2026' },
  ],
};

describe('the MCA director report', () => {
  const data = normalizeDinResponse(capturedDirectorSchema.parse(MCA_REPORT) as Record<string, unknown>, '06419899');

  it('keeps every row of the portal table', () => {
    expect(data.name).toBe('AMEERUDDIN SYED');
    expect(data.associations).toHaveLength(6);
  });

  it('reads a dash as empty, not as a value', () => {
    const zilika = data.associations.find((a) => a.companyName.startsWith('ZILIKA'))!;
    expect(zilika.appointmentCategory).toBe('');
    expect(zilika.currentDesignationDate).toBe('');
  });

  it('splits standing appointments from ceased ones', () => {
    expect(currentAssociations(data).map((a) => a.companyName)).toEqual([
      'MAGELLANIC CLOUD LIMITED',
      'PROVIGIL SURVEILLANCE LIMITED',
      'MOTIVITY LABS PRIVATE LIMITED',
      'TECHNICHE ITES PRIVATE LIMITED',
    ]);
    expect(pastAssociations(data).map((a) => a.cessationDate)).toEqual(['2026-09-23', '2024-07-14']);
  });

  it('keeps one company twice when the person held two designations in it', () => {
    const provigil = data.associations.filter((a) => a.cin === 'U65993TG1992PLC014157');
    expect(provigil.map((a) => a.designation)).toEqual(['Director', 'Additional Director']);
    expect(provigil[0].currentDesignationDate).toBe('2024-07-15');
  });

  it('carries the company status and converts the portal date format', () => {
    const techniche = data.associations.find((a) => a.companyName.startsWith('TECHNICHE'))!;
    expect(techniche.companyStatus).toBe('Strike Off');
    expect(techniche.appointmentDate).toBe('2013-01-01');
    expect(techniche.appointmentCategory).toBe('Promoter');
  });

  it('reads a listed company CIN as a company, not an LLP', () => {
    expect(data.associations.every((a) => a.entityType === 'company')).toBe(true);
  });
});
