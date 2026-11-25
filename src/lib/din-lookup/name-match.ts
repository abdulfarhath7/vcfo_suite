/**
 * Comparing the name a client typed with the name MCA holds against the DIN.
 *
 * MCA prints one upper-case string in no fixed order: "AMEERUDDIN SYED" may be the first name
 * then the surname, or the surname first. Initials, extra middle names and titles are common.
 * So the comparison is on the set of name words, never on the exact string, and the answer is
 * advice for the project lead, never an automatic verdict: DR-01 and firm policy SBC-STD-AI-02
 * both leave the decision with the person.
 */

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'smt', 'sri', 'md', 'mohd']);

/** Upper-case words, punctuation dropped, titles dropped, single letters kept as initials. */
export function nameWords(value: string): string[] {
  return value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !TITLES.has(w.toLowerCase()));
}

export type NameMatch =
  /** The same words, whatever their order. */
  | { kind: 'same' }
  /** One name holds every word of the other and adds more (a middle name MCA does not carry). */
  | { kind: 'close'; extra: string[] }
  /** Words that do not line up at all. */
  | { kind: 'differs' }
  /** One of the two names is missing, so there is nothing to compare. */
  | { kind: 'unknown' };

/**
 * Compare the director's name in the checklist with the name on the MCA record.
 * `extra` on a close match names the words only one side has, so the lead sees the difference.
 */
export function compareDirectorName(entryName: string, mcaName: string): NameMatch {
  const a = nameWords(entryName);
  const b = nameWords(mcaName);
  if (a.length === 0 || b.length === 0) return { kind: 'unknown' };

  const setA = new Set(a);
  const setB = new Set(b);
  const shared = [...setA].filter((w) => setB.has(w));
  if (shared.length === setA.size && shared.length === setB.size) return { kind: 'same' };

  const onlyA = [...setA].filter((w) => !setB.has(w));
  const onlyB = [...setB].filter((w) => !setA.has(w));

  // Every word of the shorter name appears in the longer one: the same person, written longer.
  if (onlyA.length === 0 || onlyB.length === 0) return { kind: 'close', extra: [...onlyA, ...onlyB] };

  // An initial standing for a full word ("A SYED" against "AMEERUDDIN SYED") is still close.
  const initialsExplain = (short: string[], long: string[]) =>
    short.every((w) => w.length > 1 || long.some((l) => l.startsWith(w)));
  if (shared.length > 0 && (initialsExplain(onlyA, onlyB) || initialsExplain(onlyB, onlyA))) {
    return { kind: 'close', extra: [...onlyA, ...onlyB] };
  }

  return { kind: 'differs' };
}

/** The sentence the lead reads on the card, and the note a mismatch would carry. */
export function nameMatchMessage(match: NameMatch, mcaName: string): string {
  switch (match.kind) {
    case 'same':
      return 'The name matches the MCA record.';
    case 'close':
      return `Close, but not word for word. MCA holds "${mcaName}". Differences: ${match.extra.join(', ')}.`;
    case 'differs':
      return `MCA holds "${mcaName}" against this DIN.`;
    case 'unknown':
      return 'There is no name to compare yet.';
  }
}
