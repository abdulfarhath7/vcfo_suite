/**
 * Tiny HTML helpers for government pages that are server-rendered tables or
 * lists (no JSON behind them). Deliberately simple: split on tags we know,
 * decode entities, strip the rest. Pure, so each watcher's parser can be
 * unit-tested on a saved copy of the page.
 */

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)));
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Every <tr>…</tr> block, in page order. */
export function tableRows(html: string): string[] {
  return html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
}

/** The inner HTML of each <td> in a row. */
export function cells(row: string): string[] {
  return (row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((td) => td.replace(/^<td[^>]*>/i, '').replace(/<\/td>$/i, ''));
}

/** Every anchor in a fragment: href + visible text. */
export function anchors(html: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    out.push({ href: decodeEntities(m[1]!.trim()), text: stripTags(m[2]!) });
  }
  return out;
}

/** "23-10-2026", "23/10/2026", "2026-10-23" → "2026-10-23". */
export function dmyToYmd(value: string): string | null {
  const t = value.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return t;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}

export function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}
