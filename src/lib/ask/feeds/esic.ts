import 'server-only';

import { absoluteUrl, anchors, cells, dmyToYmd, stripTags, tableRows } from './html';
import { fetchPdf, fetchText } from './govt-fetch';
import type { FeedContent, FeedItem, FeedWatcher } from './types';

/**
 * ESIC (Employees' State Insurance Corporation) — circulars page, a
 * server-rendered table: S.No · Branch · Dated · Subject (PDF links) ·
 * Publish date · Console serial no. The console serial ("26908/2026") is
 * ESIC's own id. Checked 2026-10-23.
 *
 * Most ESIC circulars are internal (postings, hospital sanctions). Only the
 * ones an employer must act on are kept — see `isEmployerRelevant`.
 */
const BASE = 'https://esic.gov.in';
const LIST_URL = `${BASE}/circulars`;

const EMPLOYER_TERMS =
  /\b(employer|contribution|wage|wages|ceiling|coverage|registration|compliance|return|challan|penalt|interest|due date|amendment|scheme|insured person|IP\b|Aadhaar|seeding|exempt|threshold|notification|rule|regulation|benefit|maternity|ESI Act|e-pehchan|TIC\b|portal)/i;

export function isEmployerRelevant(subject: string): boolean {
  if (/\b(posting|transfer|promotion|recruitment|tender|hospital|dispensary|medical officer|seniority|leave|APAR|vigilance|sanction of manpower|office order)\b/i.test(subject)) {
    return false;
  }
  return EMPLOYER_TERMS.test(subject);
}

/** Pure: the circulars table → feed items (newest first as on the page). */
export function parseEsicCirculars(html: string): Array<FeedItem & { pdfUrl: string }> {
  const out: Array<FeedItem & { pdfUrl: string }> = [];
  for (const row of tableRows(html)) {
    const c = cells(row);
    if (c.length < 6) continue;
    const branch = stripTags(c[1] ?? '');
    const dated = dmyToYmd(stripTags(c[2] ?? '')) ?? dmyToYmd(stripTags(c[4] ?? ''));
    const serial = stripTags(c[5] ?? '');
    const links = anchors(c[3] ?? '').filter((a) => /\.pdf(\?|$)/i.test(a.href));
    if (!dated || !serial || links.length === 0) continue;
    // The first PDF is the circular itself; later ones are enclosures.
    const main = links[0]!;
    const subject = main.text.replace(/-?\s*PDF.*$/i, '').replace(/\s+/g, ' ').trim();
    if (!subject) continue;
    out.push({
      externalId: `esic:${serial}`,
      number: serial,
      title: `ESIC circular ${serial} · ${branch} · ${subject}`.slice(0, 300),
      kind: 'Circular',
      publishedAt: dated,
      publicUrl: LIST_URL,
      pdfUrl: absoluteUrl(main.href, BASE),
    });
  }
  return out.filter((i) => isEmployerRelevant(i.title));
}

let lastPdfUrls = new Map<string, string>();

export const esicWatcher: FeedWatcher = {
  id: 'esic',
  label: 'ESIC · circulars for employers',
  act: 'Labour',
  homeUrl: LIST_URL,
  async list() {
    const items = parseEsicCirculars(await fetchText(LIST_URL));
    lastPdfUrls = new Map(items.map((i) => [i.externalId, i.pdfUrl]));
    return items.map(({ pdfUrl: _pdf, ...item }) => item);
  },
  async fetch(item: FeedItem): Promise<FeedContent> {
    const url = lastPdfUrls.get(item.externalId);
    if (!url) throw new Error('ESIC circular link is no longer on the page; it will be retried on the next check.');
    return fetchPdf(url, `${item.number ?? item.externalId}.pdf`);
  },
};
