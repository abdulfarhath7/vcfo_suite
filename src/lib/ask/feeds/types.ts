/**
 * Official-update watchers for Ask VCFO (2026-10-22).
 *
 * A watcher knows one government source. It answers two questions:
 *   1. list()   — "what has this source published lately?" (cheap: titles, ids, dates)
 *   2. fetch()  — "give me the full document for this item" (the PDF or the text)
 * The poller (`poll.ts`) asks every watcher for its list, drops the items we
 * already have (by `externalId`), and sends each new one through the same
 * extract → chunk → contextualize → index pipeline an admin upload uses.
 */

/** The law or regulator an update belongs to; shown on the Sources page and to the model. */
export type FeedAct = 'GST' | 'Customs' | 'Income Tax' | 'Companies Act' | 'FEMA / RBI' | 'Labour';

export interface FeedItem {
  /** The publisher's own id — the de-duplication key (never downloaded twice). */
  externalId: string;
  /** e.g. "01/2026-Central Tax (Rate)" — what a CA would quote. */
  number: string | null;
  title: string;
  /** "Notification", "Circular", "Press release" … */
  kind: string;
  /** YYYY-MM-DD, IST calendar day. */
  publishedAt: string;
  /** A page a person can open to read it on the government site. */
  publicUrl: string;
}

/** The full content of one item: a file (usually a PDF) or plain text. */
export type FeedContent =
  | { kind: 'file'; bytes: Buffer; fileName: string; contentType: string }
  | { kind: 'text'; text: string };

export interface FeedWatcher {
  id: string;
  /** Short label for the admin ("CBIC · GST notifications and circulars"). */
  label: string;
  act: FeedAct;
  /** Where a person can see the same list. */
  homeUrl: string;
  list(): Promise<FeedItem[]>;
  fetch(item: FeedItem): Promise<FeedContent>;
}

/** Same browser-like identity for every government request; some sites refuse bare clients. */
export const GOVT_FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Safari/537.36 VCFO-Suite/1.0',
  Accept: 'application/json, text/plain, */*',
};

/** "25-Jul-2026" / "October 19, 2026" / a Date → "2026-07-25". Null when unreadable. */
export function toYmd(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const dmy = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  if (dmy) {
    const m = months[dmy[2]!.toLowerCase()];
    return m ? `${dmy[3]}-${m}-${dmy[1]!.padStart(2, '0')}` : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
