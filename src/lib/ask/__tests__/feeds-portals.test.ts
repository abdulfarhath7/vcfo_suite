import { describe, expect, it } from 'vitest';
import { parseDgftTable } from '@/lib/ask/feeds/dgft';
import { isEmployerRelevantEpfo, parseEpfoNotices } from '@/lib/ask/feeds/epfo';
import { isEmployerRelevant, parseEsicCirculars } from '@/lib/ask/feeds/esic';
import { cells, dmyToYmd, stripTags, tableRows } from '@/lib/ask/feeds/html';

// Rows copied from the live pages on 2026-10-23, trimmed.
const ESIC_HTML = `
<table>
<tr><th>S.No.</th><th>Branch</th><th>Dated</th><th>Subject</th><th>Publish Date</th><th>Console Sl. No.</th></tr>
<tr> <td>1</td> <td>ICT Division</td> <td>23-10-2026</td> <td> <a href="/attachments/circularfile/Intensification_of_Aadhaar_Seeding_of_Insured_Persons_1792579955.pdf" target="_blank">Intensification of Aadhaar Seeding of Insured Persons and Their Beneficiaries- PDF <img src="/img/pdf_icon1.png" /> size:(231.81 KB) .</a> </td> <td>2026-10-23</td> <td>26908/2026</td> </tr>
<tr> <td>2</td> <td>Med-VI</td> <td>22-10-2026</td> <td> <a href="/attachments/circularfile/Sanction_of_manpower_for_establishment_of_50_Bedded_Ayush_Hospital_1792667660.pdf">Sanction of manpower for establishment of 50 Bedded Ayush Hospital in ESIC Hospitals &amp; Medical College- PDF size:(1 MB) .</a> </td> <td>2026-10-22</td> <td>26902/2026</td> </tr>
</table>`;

const DGFT_HTML = `
<table>
<tr> <th>Sl.No.</th> <th>Number</th> <th>Year</th> <th>Description</th> <th>Date</th> <th style="display:none">CRT DT</th> <th>Attachment</th> </tr>
<tr> <td>1</td> <td>45/2026-27</td> <td>2026</td> <td>Amendment in import policy of raw sugar classified under Exim Code 170114 of Chapter 17 of Schedule–1 (Import Policy) of ITC (HS), 2022- reg.</td> <td>19/10/2026</td> <td style="display:none">21/10/2026 12:21:47</td> <td> <a title="Download" href="https://content.dgft.gov.in/Website/dgftprod/91d58a2c/Eng Notification 45_0001 (1).pdf" target="_blank" download> Download (Type : PDF)</a> </td> </tr>
</table>`;

// Two items from https://www.epfo.gov.in/?post_type=notices&feed=rss2 on 2026-10-23, trimmed.
const EPFO_RSS = `<rss><channel>
<item>
<title>Notice Inviting Application for Empanelment of Advocates for EPFO UP Zone</title>
<link>https://www.epfo.gov.in/notices/notice-inviting-application-for-empanelment-of-advocates-for-epfo-up-zone/</link>
<pubDate>Thu, 15 Oct 2026 06:31:49 +0000</pubDate>
<guid isPermaLink="false">https://www.epfo.gov.in/?post_type=notices&#038;p=16318</guid>
<content:encoded><![CDATA[<p><a href="https://pmvbry-cdn.epfindia.gov.in/wp-content/uploads/2026/10/ZOUP_Letter.pdf">ZO(UP) Letter</a></p>]]></content:encoded>
</item>
<item>
<title>Wage Ceiling Circular 28.09.2026</title>
<link>https://www.epfo.gov.in/notices/wage-ceiling-circular-28-09-2026/</link>
<pubDate>Tue, 29 Sep 2026 14:00:38 +0000</pubDate>
<guid isPermaLink="false">https://www.epfo.gov.in/notices/wage-ceiling-circular-28-09-2026/</guid>
<content:encoded><![CDATA[<p><a href="https://pmvbry-cdn.epfindia.gov.in/wp-content/uploads/2026/09/Annexure.pdf">Annexure</a></p>
<p><a href="https://pmvbry-cdn.epfindia.gov.in/wp-content/uploads/2026/09/Wage-Ceiling-Circular-28.09.2026.pdf">Wage Ceiling Circular 28.09.2026</a></p>]]></content:encoded>
</item>
</channel></rss>`;

describe('html helpers', () => {
  it('splits rows and cells, strips tags, reads dd-mm-yyyy and dd/mm/yyyy', () => {
    const rows = tableRows(ESIC_HTML);
    expect(rows).toHaveLength(3);
    expect(cells(rows[1]!)).toHaveLength(6);
    expect(stripTags('<b>A &amp; B</b>  <i>c</i>')).toBe('A & B c');
    expect(dmyToYmd('23-10-2026')).toBe('2026-10-23');
    expect(dmyToYmd('19/10/2026')).toBe('2026-10-19');
    expect(dmyToYmd('2026-10-23')).toBe('2026-10-23');
    expect(dmyToYmd('October 2026')).toBeNull();
  });
});

describe('ESIC watcher', () => {
  it('reads circular rows and keeps only employer-relevant ones', () => {
    const items = parseEsicCirculars(ESIC_HTML);
    expect(items.map((i) => i.externalId)).toEqual(['esic:26908/2026']);
    expect(items[0]).toMatchObject({ number: '26908/2026', publishedAt: '2026-10-23', kind: 'Circular' });
    expect(items[0]!.title).toContain('Aadhaar Seeding');
    expect(items[0]!.pdfUrl).toBe('https://esic.gov.in/attachments/circularfile/Intensification_of_Aadhaar_Seeding_of_Insured_Persons_1792579955.pdf');
    expect(isEmployerRelevant('Sanction of manpower for establishment of hospital')).toBe(false);
    expect(isEmployerRelevant('Revision of wage ceiling for coverage under ESI Act')).toBe(true);
  });
});

describe('DGFT watcher', () => {
  it('reads a notification row with number, date and PDF', () => {
    const items = parseDgftTable(DGFT_HTML, 'Notification');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ externalId: 'dgft:notification:45/2026-27', number: '45/2026-27', publishedAt: '2026-10-19' });
    expect(items[0]!.title).toContain('raw sugar');
    expect(items[0]!.pdfUrl).toContain('content.dgft.gov.in');
  });
});

describe('EPFO watcher', () => {
  it('reads the notices feed, keeps employer circulars, drops tenders and empanelments, and picks the circular PDF', () => {
    const items = parseEpfoNotices(EPFO_RSS);
    expect(items.map((i) => i.externalId)).toEqual(['epfo:https://www.epfo.gov.in/notices/wage-ceiling-circular-28-09-2026/']);
    expect(items[0]).toMatchObject({ publishedAt: '2026-09-29', kind: 'Circular', title: 'EPFO · Wage Ceiling Circular 28.09.2026' });
    // The circular itself, not its annexure.
    expect(items[0]!.pdfUrl).toBe('https://pmvbry-cdn.epfindia.gov.in/wp-content/uploads/2026/09/Wage-Ceiling-Circular-28.09.2026.pdf');
    expect(isEmployerRelevantEpfo('Posting of Enforcement Officers on promotion')).toBe(false);
    expect(isEmployerRelevantEpfo('Rate of interest on EPF for 2025-26')).toBe(true);
  });
});
