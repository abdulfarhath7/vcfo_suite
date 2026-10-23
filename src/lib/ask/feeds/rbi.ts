import 'server-only';

import { fetchOfficialFeedXml, parseRssOrAtom, type ParsedFeedItem } from '@/lib/announcements';
import { toYmd, type FeedContent, type FeedItem, type FeedWatcher } from './types';

/**
 * Reserve Bank of India — notifications RSS (a real, published feed). Each
 * item carries the full notification text, so no second download is needed.
 *
 * RBI issues many directions that only concern banks. A client of a corporate
 * services firm needs the FEMA side: foreign investment, overseas investment,
 * borrowing from abroad, remittances, reporting. `isFemaRelevant` keeps those.
 */
const FEED_URL = 'https://www.rbi.org.in/notifications_rss.xml';

const FEMA_TERMS =
  /\b(FEMA|foreign exchange management|foreign (direct )?investment|FDI|overseas (direct )?investment|ODI|external commercial borrowing|ECB|liberalised remittance|LRS|non-resident|NRI|FC-GPR|FC-TRS|single master form|FIRMS|downstream investment|annual return on foreign liabilities|FLA)\b/i;

/** Pure: is this RBI item about foreign exchange / investment (FEMA), not bank-only rules? */
export function isFemaRelevant(item: Pick<ParsedFeedItem, 'title' | 'body'>): boolean {
  return FEMA_TERMS.test(item.title) || FEMA_TERMS.test(item.body.slice(0, 4000));
}

/** "RBI/2026-27/296" from the notice text, when present. */
export function rbiCircularNumber(body: string): string | null {
  return /RBI\/\d{4}-\d{2}\/\d+/.exec(body)?.[0] ?? null;
}

/** Pure: RSS items → feed items, keeping only FEMA-relevant ones; the text travels in `bodies`. */
export function parseRbiItems(items: ParsedFeedItem[]): { items: FeedItem[]; bodies: Map<string, string> } {
  const bodies = new Map<string, string>();
  const out: FeedItem[] = [];
  for (const it of items) {
    if (!isFemaRelevant(it)) continue;
    const publishedAt = toYmd(it.publishedAt);
    if (!publishedAt || !it.externalId) continue;
    const number = rbiCircularNumber(it.body);
    out.push({
      externalId: it.externalId,
      number,
      title: [number, it.title.trim()].filter(Boolean).join(' · ').slice(0, 300),
      kind: 'Notification',
      publishedAt,
      publicUrl: it.link,
    });
    bodies.set(it.externalId, `# ${it.title.trim()}\n\n${it.body.trim()}`);
  }
  return { items: out, bodies };
}

let lastBodies = new Map<string, string>();

export const rbiFemaWatcher: FeedWatcher = {
  id: 'rbi-fema',
  label: 'RBI · FEMA and foreign investment notifications',
  act: 'FEMA / RBI',
  homeUrl: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx',
  async list() {
    const parsed = parseRbiItems(parseRssOrAtom(await fetchOfficialFeedXml(FEED_URL)));
    lastBodies = parsed.bodies;
    return parsed.items;
  },
  async fetch(item: FeedItem): Promise<FeedContent> {
    const text = lastBodies.get(item.externalId);
    if (!text) throw new Error('RBI notice text is no longer in the feed; it will be retried on the next check.');
    return { kind: 'text', text };
  },
};
