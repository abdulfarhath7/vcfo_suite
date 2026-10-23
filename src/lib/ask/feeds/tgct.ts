import 'server-only';

import { fetchPdf, fetchText } from './govt-fetch';
import { absoluteUrl, anchors, cells, stripTags, tableRows } from './html';
import type { FeedContent, FeedItem, FeedWatcher } from './types';

/**
 * Telangana Commercial Taxes Department (tgct.gov.in) — Profession Tax and
 * Telangana GST. The owner's list names the portal home. What it offers
 * (checked 2026-10-23):
 *   - "Announcements › View More" (GST/Announcements_More.aspx): a one-column
 *     table of PDF links, newest first, **without dates**.
 *   - Profession Tax "GO's & Notifications": ASP.NET postback links, and the
 *     newest entry is from 2021 — nothing to watch.
 * So this watcher reads the announcements list. The portal gives no date, so
 * an item is dated the day it was first seen, and the title says so. Only
 * files not seen before are taken, so the first check takes what is listed
 * today and later checks take only genuinely new files. Tenders, vacancies
 * and office stationery notices are skipped.
 */
const BASE = 'https://www.tgct.gov.in/tgportal/';
const LIST_URL = `${BASE}GST/Announcements_More.aspx`;

const NOT_FOR_TAXPAYERS = /tender|vacancy|stationery|stationary|recruitment|empanel|transfer|posting/i;

export function parseTgctAnnouncements(html: string, firstSeen: string): Array<FeedItem & { pdfUrl: string }> {
  const out: Array<FeedItem & { pdfUrl: string }> = [];
  for (const row of tableRows(html)) {
    const c = cells(row);
    if (c.length !== 1) continue;
    const link = anchors(c[0]!).find((a) => /\.pdf(\?|$)/i.test(a.href));
    if (!link) continue;
    const title = stripTags(c[0]!);
    if (!title || NOT_FOR_TAXPAYERS.test(title)) continue;
    const pdfUrl = absoluteUrl(link.href, LIST_URL);
    const fileName = decodeURIComponent(new URL(pdfUrl).pathname.split('/').pop() ?? '');
    if (!fileName) continue;
    out.push({
      externalId: `tgct:${fileName}`,
      number: null,
      title: `Telangana Commercial Taxes · ${title} (listed without a date; first seen ${firstSeen})`.slice(0, 300),
      kind: 'Announcement',
      publishedAt: firstSeen,
      publicUrl: LIST_URL,
      pdfUrl,
    });
  }
  return out;
}

let lastPdfUrls = new Map<string, string>();

export const tgctWatcher: FeedWatcher = {
  id: 'tgct',
  label: 'Telangana Commercial Taxes (tgct.gov.in) · announcements: Profession Tax and Telangana GST',
  act: 'Professional Tax',
  homeUrl: LIST_URL,
  async list() {
    const today = new Date().toISOString().slice(0, 10);
    const items = parseTgctAnnouncements(await fetchText(LIST_URL), today);
    lastPdfUrls = new Map(items.map((i) => [i.externalId, i.pdfUrl]));
    return items.map(({ pdfUrl: _pdf, ...item }) => item);
  },
  async fetch(item: FeedItem): Promise<FeedContent> {
    const url = lastPdfUrls.get(item.externalId);
    if (!url) throw new Error('Telangana link is no longer on the page; it will be retried on the next check.');
    return fetchPdf(url, item.externalId.replace(/^tgct:/, ''));
  },
};
