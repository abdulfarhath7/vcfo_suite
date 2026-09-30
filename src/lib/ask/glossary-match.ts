import type { GlossaryTerm } from '@/data/ask/schema';

export type GlossarySegment = { text: string } | { text: string; term: GlossaryTerm };

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Acronyms (DIN, PAN) match exactly; words (Professional Tax) ignore case. */
function isAcronym(s: string): boolean {
  return s === s.toUpperCase();
}

/**
 * Split `text` into plain and glossary segments (F2). Each term is marked
 * only at its first occurrence in the block; longer spellings win over
 * shorter ones (GSTIN before GST). Boundaries are "not a letter or digit" so
 * "SPICe+" and "FC-GPR" match as written.
 */
export function withGlossary(text: string, terms: readonly GlossaryTerm[]): GlossarySegment[] {
  if (!text || terms.length === 0) return [{ text }];
  const spellings = terms
    .flatMap((term) => [term.term, ...term.aliases].map((spelling) => ({ spelling, term })))
    .sort((a, b) => b.spelling.length - a.spelling.length);

  const used = new Set<string>();
  const hits: Array<{ start: number; end: number; term: GlossaryTerm }> = [];
  for (const { spelling, term } of spellings) {
    if (used.has(term.term)) continue;
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(spelling)}(?![A-Za-z0-9])`, isAcronym(spelling) ? 'g' : 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (hits.some((h) => start < h.end && end > h.start)) continue;
      hits.push({ start, end, term });
      used.add(term.term);
      break;
    }
  }
  if (hits.length === 0) return [{ text }];
  hits.sort((a, b) => a.start - b.start);
  const out: GlossarySegment[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start > cursor) out.push({ text: text.slice(cursor, h.start) });
    out.push({ text: text.slice(h.start, h.end), term: h.term });
    cursor = h.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

/** The first glossary term named in `text`, if any (field help icons). */
export function firstGlossaryTerm(text: string, terms: readonly GlossaryTerm[]): GlossaryTerm | null {
  const hit = withGlossary(text, terms).find((seg): seg is { text: string; term: GlossaryTerm } => 'term' in seg);
  return hit?.term ?? null;
}
