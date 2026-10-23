import 'server-only';

import { anchors, cells, dmyToYmd, stripTags, tableRows } from './html';
import { fetchPdf, fetchText } from './govt-fetch';
import type { FeedContent, FeedItem, FeedWatcher } from './types';

/**
 * DGFT (Directorate General of Foreign Trade) — notifications, public
 * notices, circulars and trade notices under "Regulatory Updates" (the four
 * lists the owner's portal page links to). Each is a server-rendered
 * table: Sl.No · Number · Year · Description · Date · (hidden created) ·
 * Attachment (PDF on content.dgft.gov.in). Checked 2026-10-23. Everything
 * here is trade policy an IEC holder may need, so nothing is filtered.
 */
const BASE = 'https://www.dgft.gov.in/CP/';
const LISTS = [
  { opt: 'notification', kind: 'Notification' },
  { opt: 'public-notice', kind: 'Public Notice' },
  { opt: 'circular', kind: 'Circular' },
  { opt: 'trade-notice', kind: 'Trade Notice' },
] as const;

export function parseDgftTable(html: string, kind: string): Array<FeedItem & { pdfUrl: string }> {
  const out: Array<FeedItem & { pdfUrl: string }> = [];
  for (const row of tableRows(html)) {
    const c = cells(row);
    if (c.length < 7) continue;
    const number = stripTags(c[1] ?? '');
    const description = stripTags(c[3] ?? '');
    const date = dmyToYmd(stripTags(c[4] ?? ''));
    const pdf = anchors(c[6] ?? '').find((a) => /\.pdf(\?|$)/i.test(a.href));
    if (!number || !date || !pdf) continue;
    out.push({
      externalId: `dgft:${kind.toLowerCase().replace(/\s+/g, '-')}:${number}`,
      number,
      title: `DGFT ${kind} ${number} · ${description}`.slice(0, 300),
      kind,
      publishedAt: date,
      publicUrl: `${BASE}?opt=${kind.toLowerCase().replace(/s+/g, '-')}`,
      pdfUrl: pdf.href,
    });
  }
  return out;
}

let lastPdfUrls = new Map<string, string>();

export const dgftWatcher: FeedWatcher = {
  id: 'dgft',
  label: 'DGFT · notifications, public notices, circulars and trade notices (Regulatory Updates)',
  act: 'Customs',
  homeUrl: `${BASE}?opt=regulatory-updates`,
  async list() {
    const all: Array<FeedItem & { pdfUrl: string }> = [];
    for (const l of LISTS) {
      try {
        all.push(...parseDgftTable(await fetchText(`${BASE}?opt=${l.opt}`), l.kind));
      } catch (error) {
        console.warn('[ask-feeds] DGFT list failed', l.opt, error);
      }
    }
    lastPdfUrls = new Map(all.map((i) => [i.externalId, i.pdfUrl]));
    return all.map(({ pdfUrl: _pdf, ...item }) => item);
  },
  async fetch(item: FeedItem): Promise<FeedContent> {
    const url = lastPdfUrls.get(item.externalId);
    if (!url) throw new Error('DGFT link is no longer on the page; it will be retried on the next check.');
    return fetchPdf(url, `${(item.number ?? item.externalId).replace(/\//g, '-')}.pdf`);
  },
};
