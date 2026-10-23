import { describe, expect, it } from 'vitest';
import { parseCbicUpdates } from '@/lib/ask/feeds/cbic';
import { isFemaRelevant, parseRbiItems, rbiCircularNumber } from '@/lib/ask/feeds/rbi';
import { pickNewItems } from '@/lib/ask/feeds/poll';
import { toYmd, type FeedItem } from '@/lib/ask/feeds/types';

// Two rows copied from CBIC's real response (2026-10-22), trimmed.
const CBIC_ROWS = [
  {
    id: 1003335,
    updatedDate: '25-Jul-2026',
    notificationNo: '256/02/2026-GST',
    notificationName: 'Clarification regarding filing of appeal by department before the Goods and Services Appellate Tribunal.',
    updateType: 'Circular',
    updateCategory: 'Circulars CGST',
  },
  {
    id: 1010645,
    updatedDate: '30-Apr-2026',
    notificationNo: '01/2026-Central Tax (Rate)',
    notificationName: 'Seeks to amend notification No. 1/2017-Central Tax (Rate)',
    updateType: 'Notification',
    updateCategory: 'Central Tax (Rate)',
  },
];

describe('toYmd', () => {
  it('reads CBIC and RSS date styles', () => {
    expect(toYmd('25-Jul-2026')).toBe('2026-07-25');
    expect(toYmd('5-Jan-2026')).toBe('2026-01-05');
    expect(toYmd(new Date('2026-10-19T00:00:00Z'))).toBe('2026-10-19');
    expect(toYmd('not a date')).toBeNull();
    expect(toYmd(null)).toBeNull();
  });
});

describe('CBIC GST watcher', () => {
  it('turns CBIC rows into feed items with a kind-scoped id, number, date and title', () => {
    const items = parseCbicUpdates(CBIC_ROWS);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: 'circular:1003335',
      number: '256/02/2026-GST',
      kind: 'Circular',
      publishedAt: '2026-07-25',
    });
    expect(items[1]!.externalId).toBe('notification:1010645');
    expect(items[1]!.title).toContain('01/2026-Central Tax (Rate)');
    expect(items[1]!.title).toContain('Central Tax (Rate)');
  });

  it('drops rows it cannot place and survives a non-list answer', () => {
    expect(parseCbicUpdates([{ id: 'x' }, { id: 5, updatedDate: '??' }])).toEqual([]);
    expect(parseCbicUpdates({ error: 'down' })).toEqual([]);
  });
});

describe('RBI FEMA watcher', () => {
  const femaItem = {
    title: 'Foreign Exchange Management (Non-debt Instruments) (Amendment) Rules, 2026',
    body: 'RBI/2026-27/301 A.P. (DIR Series) Circular No. 12 ... foreign investment in India ...',
    link: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=1',
    externalId: 'rbi-1',
    publishedAt: new Date('2026-10-20T00:00:00Z'),
  };
  const bankItem = {
    title: 'Reserve Bank of India (Small Finance Banks - Miscellaneous) Amendment Directions, 2026',
    body: 'RBI/2026-27/295 DOR.MRG.REC.No.249 Limits for Non-Option Derivative Contracts',
    link: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=2',
    externalId: 'rbi-2',
    publishedAt: new Date('2026-10-19T00:00:00Z'),
  };

  it('keeps FEMA and foreign-investment notices, drops bank-only directions', () => {
    expect(isFemaRelevant(femaItem)).toBe(true);
    expect(isFemaRelevant(bankItem)).toBe(false);
    const { items, bodies } = parseRbiItems([femaItem, bankItem]);
    expect(items.map((i) => i.externalId)).toEqual(['rbi-1']);
    expect(items[0]!.number).toBe('RBI/2026-27/301');
    expect(bodies.get('rbi-1')).toContain('foreign investment');
  });

  it('reads the RBI circular number', () => {
    expect(rbiCircularNumber('RBI/2026-27/296 DoR.AML')).toBe('RBI/2026-27/296');
    expect(rbiCircularNumber('no number here')).toBeNull();
  });
});

describe('pickNewItems (never download twice)', () => {
  const item = (externalId: string, publishedAt: string): FeedItem => ({
    externalId,
    number: null,
    title: externalId,
    kind: 'Notification',
    publishedAt,
    publicUrl: 'https://example.gov.in',
  });

  it('skips known and repeated items, newest first, capped', () => {
    const listed = [item('a', '2026-01-01'), item('b', '2026-03-01'), item('b', '2026-03-01'), item('c', '2026-02-01')];
    expect(pickNewItems(listed, new Set(['a']), 10).map((i) => i.externalId)).toEqual(['b', 'c']);
    expect(pickNewItems(listed, new Set(), 1).map((i) => i.externalId)).toEqual(['b']);
    expect(pickNewItems(listed, new Set(['a', 'b', 'c']), 10)).toEqual([]);
  });
});

describe('CBIC missing intermediate certificate', () => {
  it('is the Sectigo OV R36 certificate, signed by a root Node already trusts', async () => {
    const crypto = await import('node:crypto');
    const tls = await import('node:tls');
    const { SECTIGO_OV_R36_PEM } = await import('@/lib/ask/feeds/govt-https');
    const cert = new crypto.X509Certificate(SECTIGO_OV_R36_PEM);
    expect(cert.subject).toContain('Sectigo Public Server Authentication CA OV R36');
    expect(cert.fingerprint256).toBe(
      '65:42:D1:76:BE:D5:0F:19:3C:0C:E2:97:AE:44:EC:D8:A0:A8:6B:EC:2E:DE:68:27:69:34:40:59:B4:E7:85:30',
    );
    const root = tls.rootCertificates.map((p) => new crypto.X509Certificate(p)).find((r) => cert.checkIssued(r));
    expect(root?.subject).toContain('Sectigo Public Server Authentication Root R46');
    expect(cert.verify(root!.publicKey)).toBe(true);
  });
});

describe('cleanSummary', () => {
  it('drops a heading or a "Summary:" label and squashes whitespace', async () => {
    const { cleanSummary } = await import('@/lib/ask/ingest/summarize');
    expect(cleanSummary('# Summary\nCircular 255/01/2026-GST clarifies jurisdiction.')).toBe('Circular 255/01/2026-GST clarifies jurisdiction.');
    expect(cleanSummary('Summary: Rates change from 1 May 2026.')).toBe('Rates change from 1 May 2026.');
    expect(cleanSummary('  Plain   text.  ')).toBe('Plain text.');
    expect(cleanSummary('   ')).toBeNull();
  });
});

describe('review PDF facts (pure helpers)', () => {
  it('finds the instruments a notification amends and its effective date', async () => {
    const { amendedInstruments, effectiveFromPhrase, readingCheck } = await import('@/lib/ask/feeds/review-pdf');
    const text =
      'In exercise of the powers conferred, the Central Government hereby makes the following further amendments in the notification No. 1/2017-Central Tax (Rate), dated the 28th June, 2017. 2. This notification shall come into force on the 1st day of May, 2026.';
    expect(amendedInstruments(text)).toEqual(['1/2017-Central Tax (Rate)']);
    // Real CBIC wording (01/2026-Central Tax (Rate)): the issuer sits between "notification" and "No.".
    const real =
      'hereby makes the following further amendments in the notification of the Government of India, Ministry of Finance (Department of Revenue), No. 9/2025- Central Tax (Rate), published in the Gazette of India';
    expect(amendedInstruments(real)).toEqual(['9/2025- Central Tax (Rate)']);
    expect(effectiveFromPhrase(text)).toBe('1st day of May, 2026');
    expect(effectiveFromPhrase('with effect from 1st April 2026 the rate')).toBe('1st April 2026');
    expect(amendedInstruments('no references here')).toEqual([]);
    expect(effectiveFromPhrase('no date here')).toBeNull();
  });

  it('warns the manager when very little text was read', async () => {
    const { readingCheck } = await import('@/lib/ask/feeds/review-pdf');
    expect(readingCheck('a b c', 1).warning).toMatch(/Very little text/);
    const good = readingCheck('The registered office of the company shall be situated in the State of Karnataka. '.repeat(10), 2);
    expect(good.warning).toBeNull();
    expect(good.pieces).toBe(2);
    expect(good.words).toBeGreaterThan(100);
  });
});
