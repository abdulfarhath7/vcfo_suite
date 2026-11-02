import type { MergeValue } from './types';

export type TextSegment = { text: string; field?: MergeValue };

const MIN_LENGTH = 2;

/** A template placeholder is not a known value: "[Designation]", "__________" or empty. */
export function isPlaceholder(value: string | null | undefined): boolean {
  const t = (value ?? '').trim();
  return !t || /^\[.*\]$/.test(t) || /^_+$/.test(t);
}

/**
 * Splits a paragraph into plain text and filled values. The longest value wins where two
 * overlap, so "Northwind Technologies India" is one value, not "Northwind" plus the rest.
 */
export function segmentText(text: string, values: MergeValue[]): TextSegment[] {
  const sorted = values.filter((v) => v.value.trim().length >= MIN_LENGTH).sort((a, b) => b.value.trim().length - a.value.trim().length);
  const taken: Array<{ start: number; end: number; field: MergeValue }> = [];
  for (const field of sorted) {
    const needle = field.value.trim();
    let from = 0;
    let at: number;
    while ((at = text.indexOf(needle, from)) !== -1) {
      const end = at + needle.length;
      if (!taken.some((t) => at < t.end && end > t.start)) taken.push({ start: at, end, field });
      from = end;
    }
  }
  taken.sort((a, b) => a.start - b.start);
  const out: TextSegment[] = [];
  let pos = 0;
  for (const t of taken) {
    if (t.start > pos) out.push({ text: text.slice(pos, t.start) });
    out.push({ text: text.slice(t.start, t.end), field: t.field });
    pos = t.end;
  }
  if (pos < text.length || out.length === 0) out.push({ text: text.slice(pos) });
  return out;
}
