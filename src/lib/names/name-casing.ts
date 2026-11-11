/**
 * Letter casing for a company or person name in a generated document (GL-09).
 *
 * A legal document must not print "ember technologies private limited". Each word starts with
 * a capital letter; a word the person typed in capitals stays as typed ("EMBER", "IBM"); and
 * the entity suffixes LLP and OPC are always capitals. Every document generator calls this one
 * function, so the preview and the download agree.
 *
 *   "ember technologies private limited" -> "Ember Technologies Private Limited"
 *   "abc (india) llp"                    -> "Abc (India) LLP"
 */

/** Words that are always written in capitals, whatever was typed. */
const ALWAYS_CAPITALS: ReadonlySet<string> = new Set(['llp', 'opc']);

export function properNameCase(value: string | null | undefined): string {
  const text = (value ?? '').replace(/[ \t]+/g, ' ').trim();
  if (!text) return '';
  // A `[placeholder]` shown while an answer is missing keeps its case.
  if (/^\[.*\]$/.test(text)) return text;
  // A run of letters is a word unless it follows an apostrophe (the "s" of "Rao's").
  return text.replace(/(^|[^\p{L}'’])(\p{L}+)/gu, (_match, before: string, word: string) => {
    if (ALWAYS_CAPITALS.has(word.toLowerCase())) return before + word.toUpperCase();
    if (word.length > 1 && word === word.toUpperCase()) return before + word;
    return before + word.charAt(0).toUpperCase() + word.slice(1);
  });
}
