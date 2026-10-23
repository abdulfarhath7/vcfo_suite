import 'server-only';

import { fetchPdf, fetchText } from './govt-fetch';
import { absoluteUrl, anchors, stripTags } from './html';
import { toYmd, type FeedContent, type FeedItem, type FeedWatcher } from './types';

/**
 * Income Tax Department — "Latest News" on the e-filing portal
 * (incometax.gov.in). The owner's list names incometaxindia.gov.in, which
 * refuses every program and even headless Chrome ("Access Denied", checked
 * 2026-10-23). The department's e-filing portal is the same authority and
 * publishes the CBDT notifications and circulars with a dated line and the
 * PDF on the same host, readable by a plain request. Newest first, ten per
 * page; the first page is enough for a 30-minute check.
 *
 * Markup (Drupal view): each item is
 *   <div class="views-row"> … <div class="up-date"> 12-Oct-2026</div> …
 *   <div class="d-flex gry-ft"><p>CBDT Notification No. 133/2026 … <a href="…pdf">Click here</a></p></div>
 */
const BASE = 'https://www.incometax.gov.in';
const LIST_URL = `${BASE}/iec/foportal/latest-news`;

export interface IncomeTaxNewsItem extends FeedItem {
  pdfUrl: string | null;
  text: string;
}

/** Pure: the latest-news page → items (newest first, as listed). */
export function parseIncomeTaxNews(html: string): IncomeTaxNewsItem[] {
  const out: IncomeTaxNewsItem[] = [];
  for (const row of html.split(/class="views-row"/).slice(1)) {
    const date = /class="up-date">\s*([^<]+)</.exec(row)?.[1]?.trim();
    const publishedAt = date ? toYmd(date) : null;
    if (!publishedAt) continue;
    const marker = row.indexOf('gry-ft');
    if (marker < 0) continue;
    const start = row.indexOf('>', marker) + 1;
    const end = row.indexOf('</span>', start);
    const bodyHtml = row.slice(start, end > start ? end : undefined);
    const pdf = anchors(bodyHtml).find((a) => /\.pdf(\?|$)/i.test(a.href));
    const text = stripTags(bodyHtml.replace(/<a\b[^>]*>\s*Click here\s*<\/a>/gi, ''));
    if (!text) continue;
    const rowId = /id="([0-9a-f-]{36})"/.exec(row)?.[1];
    const pdfUrl = pdf ? absoluteUrl(pdf.href, BASE) : null;
    const externalId = pdfUrl ? `incometax:${new URL(pdfUrl).pathname}` : rowId ? `incometax:${rowId}` : null;
    if (!externalId) continue;
    const numbered = /\b(Notification|Circular)\s+No\.?\s*(\d+\/\d{4})/i.exec(text);
    const kind = numbered ? numbered[1]![0]!.toUpperCase() + numbered[1]!.slice(1).toLowerCase() : 'Update';
    out.push({
      externalId,
      number: numbered?.[2] ?? null,
      title: `Income Tax · ${text}`.slice(0, 300),
      kind,
      publishedAt,
      publicUrl: LIST_URL,
      pdfUrl,
      text,
    });
  }
  return out;
}

let lastItems = new Map<string, IncomeTaxNewsItem>();

export const incomeTaxWatcher: FeedWatcher = {
  id: 'income-tax',
  label: 'Income Tax Department (incometax.gov.in) · latest news: CBDT notifications and circulars',
  act: 'Income Tax',
  homeUrl: LIST_URL,
  async list() {
    const items = parseIncomeTaxNews(await fetchText(LIST_URL));
    lastItems = new Map(items.map((i) => [i.externalId, i]));
    return items.map(({ pdfUrl: _pdf, text: _text, ...item }) => item);
  },
  async fetch(item: FeedItem): Promise<FeedContent> {
    const full = lastItems.get(item.externalId);
    if (!full) throw new Error('Income Tax item is no longer on the page; it will be retried on the next check.');
    if (full.pdfUrl) {
      return fetchPdf(full.pdfUrl, `${(full.number ?? 'income-tax-update').replace(/\//g, '-')}.pdf`);
    }
    return { kind: 'text', text: `# ${full.text.slice(0, 200)}\n\nIncome Tax Department, latest news, dated ${full.publishedAt}.\n\n${full.text}` };
  },
};
