import { describe, expect, it } from 'vitest';
import { htmlToText, parseGstPortalNews } from '@/lib/ask/feeds/gst-portal';
import { parseIncomeTaxNews } from '@/lib/ask/feeds/income-tax';
import { parseTgctAnnouncements } from '@/lib/ask/feeds/tgct';

/** Shapes copied from the live portals on 2026-10-23. */

describe('GST portal · News and Updates', () => {
  const json = JSON.stringify({
    data: [
      {
        id: 677,
        title: 'Annual Returns in the form of GSTR-9/9C for FY 2025-26',
        order: 2,
        module: 'Returns',
        content:
          '<p>Dear Taxpayer</p>\n<p> Annual Returns in the form of GSTR-9/9C for FY 2025-26 have been enabled on the GST portal from 8th October 2026.</p><p>Thanks, <br>\nTeam GSTN</p>',
        date: '13/10/2026',
        IsExternal: 'N',
        linkURl: '',
      },
      { id: 673, title: 'Gross and Net GST revenue collections for the month of September, 2026', module: 'OTHERS', content: '<p>stats</p>', date: '01/10/2026', IsExternal: 'N', linkURl: '' },
      { id: 1, title: 'Bad date', module: 'OTHERS', content: '', date: 'yesterday', IsExternal: 'N', linkURl: '' },
    ],
  });

  it('keeps advisories with the full text, drops statistics and undated rows', () => {
    const { items, bodies } = parseGstPortalNews(json);
    expect(items.map((i) => i.externalId)).toEqual(['gst-portal:677']);
    expect(items[0]).toMatchObject({
      title: 'GST portal advisory · Annual Returns in the form of GSTR-9/9C for FY 2025-26',
      kind: 'Advisory',
      publishedAt: '2026-10-13',
      publicUrl: 'https://www.gst.gov.in/newsandupdates/read/677',
      number: null,
    });
    const body = bodies.get('gst-portal:677')!;
    expect(body).toContain('# Annual Returns in the form of GSTR-9/9C for FY 2025-26');
    expect(body).toContain('Returns · dated 2026-10-13');
    expect(body).toContain('enabled on the GST portal from 8th October 2026.');
    expect(body).not.toContain('<p>');
  });

  it('rejects a challenge page instead of pretending it is a list', () => {
    expect(() => parseGstPortalNews('<!DOCTYPE html><html>challenge</html>')).toThrow(/did not return/);
  });

  it('turns HTML into readable paragraphs', () => {
    expect(htmlToText('<p>One&nbsp;line</p><p>Two &amp; three<br>four</p>')).toBe('One line\nTwo & three\nfour');
  });
});

describe('Income Tax e-filing portal · latest news', () => {
  const html = `
<div class="view-content">
<div class="views-row"><div class="views-field views-field-nothing-1"><span class="field-content"><div id="01f8a528-721d-453f-b933-1653c05029e4" class="d-flex"><div class="up-date"> 12-Oct-2026</div></div> <div class="d-flex gry-ft"> <p>CBDT Notification No. 133/2026 amends the 1988 notification to specify that Joint Commissioners (Appeals) shall be subordinate to the jurisdictional Chief Commissioner.&nbsp;<a href="https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-10/Notification-133-2026.pdf">Click here</a></p></div> </span></div></div>
<div class="views-row"><div class="views-field views-field-nothing-1"><span class="field-content"><div id="db03d658-14c6-4b57-b0a6-5c9b047ab2ca" class="d-flex"><div class="up-date"> 29-Sep-2026</div></div> <div class="d-flex gry-ft"> <p>As per Circular No.07/2026 dated 28th September,2026, the due dates for ITR and Audit Report are extended as below:</p> <p>Due date for filing of ITR: 31st October 2026</p></div> </span></div></div>
<div class="views-row"><div class="up-date"> not a date</div><div class="gry-ft"><p>ignored</p></div></div>
</div>
<nav class="pager pagerer-pager-basic">next</nav>`;

  it('reads the date, number, kind and PDF of each item', () => {
    const items = parseIncomeTaxNews(html);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: 'incometax:/iec/foportal/sites/default/files/2026-10/Notification-133-2026.pdf',
      number: '133/2026',
      kind: 'Notification',
      publishedAt: '2026-10-12',
      pdfUrl: 'https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-10/Notification-133-2026.pdf',
    });
    expect(items[0]!.title).toBe('Income Tax · CBDT Notification No. 133/2026 amends the 1988 notification to specify that Joint Commissioners (Appeals) shall be subordinate to the jurisdictional Chief Commissioner.');
    expect(items[0]!.title).not.toContain('Click here');
    // Text-only item: identified by the row id, kept as text.
    expect(items[1]).toMatchObject({
      externalId: 'incometax:db03d658-14c6-4b57-b0a6-5c9b047ab2ca',
      number: '07/2026',
      kind: 'Circular',
      publishedAt: '2026-09-29',
      pdfUrl: null,
    });
    expect(items[1]!.text).toContain('Due date for filing of ITR: 31st October 2026');
    expect(items[1]!.text).not.toContain('next');
  });
});

describe('Telangana Commercial Taxes · announcements', () => {
  const html = `
<table><tr><td class="head">Announcements</td></tr>
<tr><td><a href="../Docs/A(1)-52-2026.pdf" target="_blank">Reorganisation of Commercial Taxes Department — Assignment of Jurisdiction under the Telangana Tax on Professions, Trades, Callings and Employments Act</a></td></tr>
<tr><td><a href="../Docs/Stationary.pdf">Tender call for Rate Contract for Supply of Computer Consumable, Media and Stationary Items</a></td></tr>
<tr><td><a href="../Docs/2025REV_Ms48.pdf">The Telangana Goods and Services Tax Act, 2017 – amendment to rules</a></td></tr>
<tr><td>No link here</td></tr>
</table>`;

  it('lists taxpayer announcements as PDFs dated when first seen, skipping tenders', () => {
    const items = parseTgctAnnouncements(html, '2026-10-23');
    expect(items.map((i) => i.externalId)).toEqual(['tgct:A(1)-52-2026.pdf', 'tgct:2025REV_Ms48.pdf']);
    expect(items[0]).toMatchObject({
      publishedAt: '2026-10-23',
      kind: 'Announcement',
      pdfUrl: 'https://www.tgct.gov.in/tgportal/Docs/A(1)-52-2026.pdf',
      publicUrl: 'https://www.tgct.gov.in/tgportal/GST/Announcements_More.aspx',
    });
    expect(items[0]!.title).toContain('Telangana Commercial Taxes · Reorganisation');
    expect(items[0]!.title).toContain('first seen 2026-10-23');
  });
});
