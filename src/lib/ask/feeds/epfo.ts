import 'server-only';

import { decodeEntities, stripTags } from './html';
import { fetchPdf, fetchText } from './govt-fetch';
import { toYmd, type FeedContent, type FeedItem, type FeedWatcher } from './types';

/**
 * EPFO (Employees' Provident Fund Organisation) — the WordPress "notices"
 * feed, where new circulars appear first (the old Circulars archive page
 * stopped at 2025). Each RSS item carries the notice page, the date and, in
 * `content:encoded`, the PDF links. Checked 2026-10-23.
 *
 * Notices mix circulars with tenders and empanelments; only employer-facing
 * circulars are kept (contribution, wage ceiling, ECR, UAN, interest, EDLI,
 * scheme amendments …).
 */
const BASE = 'https://www.epfo.gov.in';
const FEED_URL = `${BASE}/?post_type=notices&feed=rss2`;
const HOME_URL = `${BASE}/`;

const EMPLOYER_TERMS =
  /\b(circular|employer|establishment|contribution|wage|ceiling|ECR\b|UAN\b|KYC|interest|EDLI|pension|EPS\b|compliance|registration|coverage|exempt|penal|damages|due date|return|challan|amendment|scheme|notification|rule|para\s*\d|ELI\b|incentive|Aadhaar|nomination|claim|withdrawal|TRRN|portal|digital)/i;

export function isEmployerRelevantEpfo(title: string): boolean {
  if (/\b(tender|empanelment|advocates?|recruitment|auction|quotation|vacancy|walk-in|hiring|posting|transfer|promotion|seniority|examination|training|compassionate|RTI|hindi|rajbhasha)\b/i.test(title)) {
    return false;
  }
  return EMPLOYER_TERMS.test(title);
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return (m?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

/** Pure: the notices RSS → feed items with the circular's PDF (first PDF in the post, preferring one named "circular"). */
export function parseEpfoNotices(xml: string): Array<FeedItem & { pdfUrl: string }> {
  const out: Array<FeedItem & { pdfUrl: string }> = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = m[1]!;
    const title = stripTags(tag(block, 'title'));
    const link = decodeEntities(tag(block, 'link'));
    const guid = decodeEntities(tag(block, 'guid')) || link;
    const publishedAt = toYmd(tag(block, 'pubDate'));
    const content = tag(block, 'content:encoded');
    const pdfs = [...content.matchAll(/<a\b[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)].map((a) => ({
      href: decodeEntities(a[1]!),
      text: stripTags(a[2]!),
    }));
    if (!title || !publishedAt || !guid || pdfs.length === 0) continue;
    const main = pdfs.find((p) => /circular/i.test(p.text)) ?? pdfs[0]!;
    out.push({
      externalId: `epfo:${guid}`,
      number: null,
      title: `EPFO · ${title}`.slice(0, 300),
      kind: 'Circular',
      publishedAt,
      publicUrl: link || HOME_URL,
      pdfUrl: main.href,
    });
  }
  return out.filter((i) => isEmployerRelevantEpfo(i.title));
}

let lastPdfUrls = new Map<string, string>();

export const epfoWatcher: FeedWatcher = {
  id: 'epfo',
  label: 'EPFO · circulars for employers',
  act: 'Labour',
  homeUrl: HOME_URL,
  async list() {
    const items = parseEpfoNotices(await fetchText(FEED_URL));
    lastPdfUrls = new Map(items.map((i) => [i.externalId, i.pdfUrl]));
    return items.map(({ pdfUrl: _pdf, ...item }) => item);
  },
  async fetch(item: FeedItem): Promise<FeedContent> {
    const url = lastPdfUrls.get(item.externalId);
    if (!url) throw new Error('EPFO notice link is no longer in the feed; it will be retried on the next check.');
    return fetchPdf(url, decodeURIComponent(url.split('/').pop() ?? 'circular.pdf').slice(-100));
  },
};
