import { coreName } from '@/lib/ask/data-router/lock';

/**
 * Which folder under `/Clients` belongs to a client. Names are compared without case, punctuation
 * and company suffixes ("Private Limited", "Pvt Ltd", "LLP"), so "Kestrel Analytics Pvt. Ltd." finds
 * the folder "Kestrel Analytics". An exact core-name match wins; otherwise a folder whose core name
 * contains the client's, or the other way round, counts when only one folder does. Anything else is
 * a question for the person, never a guess.
 */

export interface FolderOption {
  id: string;
  name: string;
}

export type FolderMatch<F extends FolderOption> =
  | { kind: 'one'; folder: F }
  | { kind: 'many'; options: F[] }
  | { kind: 'none' };

const MIN_PARTIAL = 4;

export function matchClientFolder<F extends FolderOption>(companyName: string, folders: readonly F[]): FolderMatch<F> {
  const want = coreName(companyName);
  if (!want) return { kind: 'none' };
  const exact = folders.filter((f) => coreName(f.name) === want);
  if (exact.length === 1) return { kind: 'one', folder: exact[0]! };
  if (exact.length > 1) return { kind: 'many', options: exact };
  const partial = folders.filter((f) => {
    const got = coreName(f.name);
    if (got.length < MIN_PARTIAL || want.length < MIN_PARTIAL) return false;
    return ` ${got} `.includes(` ${want} `) || ` ${want} `.includes(` ${got} `);
  });
  if (partial.length === 1) return { kind: 'one', folder: partial[0]! };
  if (partial.length > 1) return { kind: 'many', options: partial };
  return { kind: 'none' };
}
