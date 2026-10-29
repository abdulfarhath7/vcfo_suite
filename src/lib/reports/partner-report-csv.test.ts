import { describe, expect, it } from 'vitest';
import { partnerReportCsv, partnerReportCsvFilename } from './partner-report-csv';
import type { PartnerReportData } from './partner-report';

const data: PartnerReportData = {
  monthKey: '2026-10',
  monthLabel: 'October 2026',
  generatedAt: '2026-10-30T00:00:00.000Z',
  numbers: [
    { k: 'New engagements', v: 3 },
    { k: 'Average days to COI', v: '–' },
  ],
  clientLine: '4 clients in the book: 1 in incorporation and 3 incorporated.',
  managers: [{ name: 'Meera, Nair', clients: 2, onTime: '50%', overdue: 1, daysToCoi: '31 days' }],
  risks: [{ id: 'r1', title: '=HYPERLINK("x")', companyName: 'Acme "One" Ltd' }],
};

describe('partnerReportCsv', () => {
  it('writes a BOM, the sections, quoted commas and quotes, and defuses formulas', () => {
    const csv = partnerReportCsv(data, { firmName: 'SBC', preparedOn: '30 Oct' });
    expect(csv.startsWith('\uFEFFSBC partner report,October 2026\r\n')).toBe(true);
    expect(csv).toContain('New engagements,3\r\n');
    expect(csv).toContain('"Meera, Nair",2,50%,1,31 days');
    expect(csv).toContain(`"'=HYPERLINK(""x"")","Acme ""One"" Ltd"`);
  });

  it('names the file after the month', () => {
    expect(partnerReportCsvFilename('October 2026')).toBe('SBC-partner-report-October-2026.csv');
  });
});
