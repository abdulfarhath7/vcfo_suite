import type { RowSource } from '@/lib/ask/changeset/types';

/**
 * How much a document's value is worth when two documents give one fact different values (the
 * fill-everything build). Code chooses, so a fill never stops to ask: a signed or executed paper
 * beats a final one, a final one beats an ordinary one, and a draft comes last. Between two of the
 * same kind the newer one wins, read from a version number or a date in the names. On a full tie the
 * value placed first stays (a value read for its own field comes before one that only fills it, so
 * the board resolution's description leads the MOA's main objects). The losing value is never
 * dropped: the card row keeps it as a note.
 *
 * SharePoint's own modified time is not carried on the drop's files, so "newer" comes from the
 * names only (see docs/context/notes/sharepoint.md).
 */

export interface SourceStrength {
  /** 3 signed, 2 final, 1 plain, 0 draft. */
  tier: number;
  /** A version number or a date found in the names, as a sortable number; 0 when none. */
  version: number;
  /** A word for the note: "signed", "final", "draft" or "". */
  word: string;
}

const wordIn = (text: string, word: string) => new RegExp(`(?:^|[^a-z])${word}(?:[^a-z]|$)`, 'i').test(text);

function versionOf(text: string): number {
  const date = /(20\d{2})[-_. ]?(0[1-9]|1[0-2])[-_. ]?(0[1-9]|[12]\d|3[01])/.exec(text);
  if (date) return Number(`${date[1]}${date[2]}${date[3]}`);
  const version = /(?:^|[^a-z])(?:v|ver|version|rev)[ _.-]?(\d{1,3})(?:[^0-9]|$)/i.exec(text);
  return version ? Number(version[1]) : 0;
}

export function sourceStrength(source: RowSource | null | undefined): SourceStrength {
  const names = `${source?.path ?? ''} ${source?.fileName ?? ''}`;
  const version = versionOf(names);
  if (wordIn(names, 'draft')) return { tier: 0, version, word: 'draft' };
  if (wordIn(names, 'signed') || wordIn(names, 'executed') || wordIn(names, 'notarised') || wordIn(names, 'notarized')) return { tier: 3, version, word: 'signed' };
  if (wordIn(names, 'final')) return { tier: 2, version, word: 'final' };
  return { tier: 1, version, word: '' };
}

/** Positive when `a` should win over `b`, negative when `b` should, 0 on a tie. */
export function compareSources(a: RowSource | null | undefined, b: RowSource | null | undefined): number {
  const x = sourceStrength(a);
  const y = sourceStrength(b);
  return x.tier - y.tier || Math.sign(x.version - y.version);
}
