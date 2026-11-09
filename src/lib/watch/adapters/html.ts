import { assertSafeFeedUrl, elementsOf, replaceSpans, stripHtml } from '@/lib/notifications/announcements';

/**
 * Small readers for plain listing pages. Commented-out markup never counts as a listed item. A page
 * is text from outside, so each reader finds its parts in one pass and never with a lazy regular
 * expression, which takes minutes over a page that opens thousands of elements and closes none.
 */
export interface HtmlLink {
  href: string;
  text: string;
}

const HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

export const withoutComments = (html: string): string => replaceSpans(html, '<!--', '-->', () => ' ');

/** The text between the first `start` and the `end` after it. */
export function between(text: string, start: string, end: string): string | undefined {
  const from = text.indexOf(start);
  const to = from < 0 ? -1 : text.indexOf(end, from + start.length);
  return to < 0 ? undefined : text.slice(from + start.length, to);
}

/** An official absolute URL for a listed link, or null when it leaves the allowlist. */
export function officialUrl(href: string, base: string): string | null {
  try {
    return assertSafeFeedUrl(encodeURI(decodeURI(new URL(href.trim(), base).href))).href;
  } catch {
    return null;
  }
}

export function linksIn(html: string, base: string): HtmlLink[] {
  const links: HtmlLink[] = [];
  for (const { tag, inner } of elementsOf(html, ['a'])) {
    const attr = HREF.exec(tag);
    const href = attr && officialUrl(attr[1] ?? attr[2] ?? attr[3] ?? '', base);
    if (href) links.push({ href, text: stripHtml(inner) });
  }
  return links;
}

export interface TableRow {
  cells: string[];
  links: HtmlLink[][];
}

export function tableRows(html: string, base: string): TableRow[] {
  const rows: TableRow[] = [];
  for (const row of elementsOf(withoutComments(html), ['tr'])) {
    const cells = Array.from(elementsOf(row.inner, ['td']), (cell) => cell.inner);
    if (cells.length > 0) rows.push({ cells: cells.map(stripHtml), links: cells.map((cell) => linksIn(cell, base)) });
  }
  return rows;
}
