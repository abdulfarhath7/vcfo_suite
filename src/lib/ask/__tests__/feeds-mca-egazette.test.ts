import { describe, expect, it } from 'vitest';
import { gazettePdfUrl, gazetteTitle, monthsToSearch, parseGazetteRows } from '@/lib/ask/feeds/mca-egazette';

/** Rows as the e-Gazette "Search by Ministry" table showed them on 2026-10-24. */
const ROWS = [
  {
    subject:
      'Publishing of Notification for extension of tenure of Officiating Chairperson NCLAT (New Gazette, Impacted Rule : Tribunal Conditions of Service Rule 2021, Date of Applicability : 15/09/2021, Impact : Actionable )',
    issueDate: '12-Oct-2026',
    gazetteId: 'CG-DL-E-13102026-277096',
  },
  {
    subject: 'Service Rules of Indian Corporate Law Service (ICLS), 2026 (New Gazette, Impacted Rule : Article 309 of the Constitution of India)',
    issueDate: '06-Oct-2026',
    gazetteId: 'CG-DL-E-07102026-276900',
  },
  {
    subject: 'Companies (Incorporation) Amendment Rules, 2026 (New Gazette, Impacted Rule : Companies (Incorporation) Rules, 2014, Impact : Actionable )',
    issueDate: '30-Sep-2026',
    gazetteId: 'CG-DL-E-02102026-276500',
  },
  { subject: 'Broken row', issueDate: 'not a date', gazetteId: 'CG-DL-E-02102026-1' },
];

describe('MCA via the Gazette of India', () => {
  it('builds the PDF link from the gazette id (publish year + serial)', () => {
    expect(gazettePdfUrl('CG-DL-E-13102026-277096')).toBe('https://egazette.gov.in/WriteReadData/2026/277096.pdf');
    expect(gazettePdfUrl('nonsense')).toBeNull();
  });

  it('keeps the subject title and drops the "(New Gazette, …)" tail', () => {
    expect(gazetteTitle(ROWS[2]!.subject)).toBe('Companies (Incorporation) Amendment Rules, 2026');
  });

  it('keeps rule changes a client may need and skips the ministry’s own staff matters', () => {
    const items = parseGazetteRows(ROWS);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: 'CG-DL-E-02102026-276500',
      title: 'MCA gazette notification · Companies (Incorporation) Amendment Rules, 2026',
      kind: 'Gazette notification',
      publishedAt: '2026-09-30',
      publicUrl: 'https://egazette.gov.in/WriteReadData/2026/276500.pdf',
    });
  });

  it('searches the previous month too during the first week', () => {
    expect(monthsToSearch(new Date('2026-10-24T05:00:00Z'))).toEqual([{ month: 10, year: 2026 }]);
    expect(monthsToSearch(new Date('2026-10-03T05:00:00Z'))).toEqual([
      { month: 10, year: 2026 },
      { month: 9, year: 2026 },
    ]);
    expect(monthsToSearch(new Date('2027-01-02T05:00:00Z'))).toEqual([
      { month: 1, year: 2027 },
      { month: 12, year: 2026 },
    ]);
  });
});
