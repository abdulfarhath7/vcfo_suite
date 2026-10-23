import 'server-only';

import { browserCapture } from './browser-fetch';
import { decodeEntities, dmyToYmd, stripTags } from './html';
import type { FeedContent, FeedItem, FeedWatcher } from './types';

/**
 * The GST portal itself (gst.gov.in / services.gst.gov.in) — the owner's
 * portal list names it. Two things live there:
 *
 *   - "GST Law" (services.gst.gov.in/services/gstlaw/gstlawlist): a page of
 *     links. Its own words: "Act, Rule, Amendment, Notifications, etc. … may
 *     be accessed from the websites of Centre and State respectively through
 *     the links provided below." The Centre link is CBIC — which `cbic.ts`
 *     reads. So the notifications a CA quotes come from CBIC, as the portal
 *     itself directs.
 *   - "News and Updates" (www.gst.gov.in/newsandupdates): the portal's own
 *     advisories — new return forms enabled, e-invoicing changes, Council
 *     meeting FAQs, filing deadline notes. Those exist nowhere else, and this
 *     watcher reads them.
 *
 * The page loads its list from `/fomessage/newsupdates`: JSON `{ data: [...] }`
 * with the full text of every item (checked 2026-10-23). The host serves an
 * anti-robot challenge to programs, so the call goes through a real browser
 * (`browser-fetch.ts`).
 */
const HOME_URL = 'https://www.gst.gov.in/newsandupdates';
const DATA_PATH = '/fomessage/newsupdates';

export interface GstPortalNewsRow {
  id: number;
  title: string;
  module?: string;
  content?: string;
  /** dd/mm/yyyy */
  date: string;
  IsExternal?: string;
  linkURl?: string;
}

/** Monthly collection statistics are news, not something a client must act on. */
const NOT_AN_UPDATE = /revenue collections?/i;

/** HTML body → readable text with paragraph breaks kept. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*(br|\/p|\/li|\/div|\/h\d|\/tr)\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Pure: the portal's JSON → feed items, with each item's full text in `bodies`. */
export function parseGstPortalNews(json: string): { items: FeedItem[]; bodies: Map<string, string> } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('The GST portal did not return its news list');
  }
  const rows: GstPortalNewsRow[] = Array.isArray(parsed)
    ? (parsed as GstPortalNewsRow[])
    : ((parsed as { data?: GstPortalNewsRow[] })?.data ?? []);
  const items: FeedItem[] = [];
  const bodies = new Map<string, string>();
  for (const row of rows) {
    if (!row || typeof row.id !== 'number' || !row.title) continue;
    const publishedAt = dmyToYmd(String(row.date ?? ''));
    if (!publishedAt) continue;
    const title = stripTags(row.title);
    if (!title || NOT_AN_UPDATE.test(title)) continue;
    const externalId = `gst-portal:${row.id}`;
    const section = stripTags(row.module ?? '');
    items.push({
      externalId,
      number: null,
      title: `GST portal advisory · ${title}`.slice(0, 300),
      kind: 'Advisory',
      publishedAt,
      publicUrl: `${HOME_URL}/read/${row.id}`,
    });
    const external = row.IsExternal === 'Y' && row.linkURl ? `\n\nFull text: ${row.linkURl}` : '';
    bodies.set(
      externalId,
      `# ${title}\n\nGST portal (gst.gov.in) News and Updates${section ? ` · ${section}` : ''} · dated ${publishedAt}.\n\n${htmlToText(row.content ?? '')}${external}`,
    );
  }
  return { items, bodies };
}

let lastBodies = new Map<string, string>();

export const gstPortalWatcher: FeedWatcher = {
  id: 'gst-portal',
  label: 'GST portal (gst.gov.in) · News and Updates: advisories on returns, e-invoicing, registration',
  act: 'GST',
  homeUrl: HOME_URL,
  async list() {
    // The list call (not an item call like /fomessage/newsupdates/678).
    const json = await browserCapture(HOME_URL, (url) => url.includes(DATA_PATH) && !/newsupdates\/\d+/.test(url));
    const parsed = parseGstPortalNews(json);
    lastBodies = parsed.bodies;
    return parsed.items;
  },
  async fetch(item: FeedItem): Promise<FeedContent> {
    const text = lastBodies.get(item.externalId);
    if (text === undefined) throw new Error('GST portal item is no longer in the list; it will be retried on the next check.');
    return { kind: 'text', text };
  },
};
