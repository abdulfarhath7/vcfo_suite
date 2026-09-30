/**
 * Split a source document into retrieval chunks by heading / section
 * (≈300–500 tokens, counted as ~4 characters per token). Deterministic, so
 * re-running ingestion on the same text yields the same chunks.
 */

export const CHUNK_MIN_CHARS = 1200;
export const CHUNK_MAX_CHARS = 2000;

export interface SourceChunk {
  ordinal: number;
  text: string;
  heading: string | null;
}

function isHeading(block: string): boolean {
  const line = block.trim();
  if (line.includes('\n')) return false;
  if (/^#{1,6}\s+\S/.test(line)) return true;
  // Short title-like lines: "Section 12 — Registered office", "CHAPTER II".
  if (line.length <= 90 && /^(section|chapter|part|rule|schedule|annexure|article)\b/i.test(line)) return true;
  return line.length <= 60 && line === line.toUpperCase() && /[A-Z]/.test(line);
}

function cleanHeading(block: string): string {
  return block.trim().replace(/^#{1,6}\s+/, '');
}

/** Break an over-long block at sentence ends, then hard-wrap as a last resort. */
function splitLong(block: string, max: number): string[] {
  if (block.length <= max) return [block];
  const sentences = block.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [block];
  const out: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > max && current) {
      out.push(current.trim());
      current = '';
    }
    if (sentence.length > max) {
      for (let i = 0; i < sentence.length; i += max) out.push(sentence.slice(i, i + max).trim());
      continue;
    }
    current += sentence;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function chunkDocument(
  raw: string,
  opts: { minChars?: number; maxChars?: number } = {},
): SourceChunk[] {
  const min = opts.minChars ?? CHUNK_MIN_CHARS;
  const max = opts.maxChars ?? CHUNK_MAX_CHARS;
  const text = raw.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!text) return [];
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  const chunks: SourceChunk[] = [];
  let heading: string | null = null;
  let current: string[] = [];
  let currentHeading: string | null = null;
  const size = () => current.join('\n\n').length;
  const flush = () => {
    const body = current.join('\n\n').trim();
    if (body) {
      const prefixed = currentHeading && !body.startsWith(currentHeading) ? `${currentHeading}\n\n${body}` : body;
      chunks.push({ ordinal: chunks.length, text: prefixed, heading: currentHeading });
    }
    current = [];
  };

  for (const block of blocks) {
    if (isHeading(block)) {
      // A new section starts a new chunk once the current one has substance.
      if (size() >= min / 3) flush();
      heading = cleanHeading(block);
      if (current.length === 0) currentHeading = heading;
      continue;
    }
    for (const piece of splitLong(block, max)) {
      if (current.length > 0 && size() + piece.length + 2 > max) flush();
      if (current.length === 0) currentHeading = heading;
      current.push(piece);
      if (size() >= min && size() >= max * 0.8) flush();
    }
  }
  flush();
  return chunks;
}
