// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { PartnerReportDocument } from './partner-report-document';
import type { PartnerReportData } from './partner-report';

/** The partner report PDF renders to a real PDF file from the report data. */
const data: PartnerReportData = {
  monthKey: '2026-10',
  monthLabel: 'October 2026',
  generatedAt: '2026-10-29T06:00:00.000Z',
  numbers: [
    { k: 'New engagements', v: 2 },
    { k: 'Filed late', v: 1, tone: 'warn' },
    { k: 'Overdue, not filed', v: 1, tone: 'bad' },
    { k: 'Average days to COI', v: '–' },
  ],
  clientLine: '3 clients in the book: 1 in incorporation and 2 incorporated.',
  managers: [{ name: 'Pranay', clients: 3, onTime: '75%', overdue: 2, daysToCoi: '21 days' }],
  risks: [{ id: 'r1', title: 'GSTR-3B overdue', companyName: 'Northwind' }],
};

describe('PartnerReportDocument', () => {
  it('renders a PDF', async () => {
    const pdf = await renderToBuffer(<PartnerReportDocument data={data} firmName="SBC" logo={null} preparedOn="29 Oct" />);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  }, 20_000);
});
