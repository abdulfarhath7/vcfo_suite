import type { PublicDownloadFile, PublicDownloadGroup } from '@/lib/document-downloads/catalog';

/**
 * Selection rules for the "Download documents" pop-up. Pure, so the browser and the tests share
 * them. Only ready files can be ticked; a group is ticked when all its ready files are.
 */

export function publicFilesIn(g: PublicDownloadGroup): PublicDownloadFile[] {
  return [...g.files, ...g.groups.flatMap(publicFilesIn)];
}

export function readyKeysIn(g: PublicDownloadGroup): string[] {
  return publicFilesIn(g)
    .filter((f) => f.ready)
    .map((f) => f.key);
}

export type TickState = 'all' | 'some' | 'none';

export function groupTickState(g: PublicDownloadGroup, selected: ReadonlySet<string>): TickState {
  const keys = readyKeysIn(g);
  const on = keys.filter((k) => selected.has(k)).length;
  if (on === 0) return 'none';
  return on === keys.length ? 'all' : 'some';
}

/** Tick or untick every ready file in a group. */
export function toggleGroup(g: PublicDownloadGroup, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  const keys = readyKeysIn(g);
  const tickAll = groupTickState(g, selected) !== 'all';
  for (const k of keys) {
    if (tickAll) next.add(k);
    else next.delete(k);
  }
  return next;
}

export interface QuickPick {
  id: string;
  label: string;
  keys: string[];
}

function findGroup(root: PublicDownloadGroup, id: string): PublicDownloadGroup | undefined {
  if (root.id === id) return root;
  for (const g of root.groups) {
    const hit = findGroup(g, id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * The quick picks above the tree: each part, each director, every uploaded file, and everything.
 * A pick with nothing ready is left out.
 */
export function quickPicks(root: PublicDownloadGroup): QuickPick[] {
  const picks: QuickPick[] = [];
  const add = (id: string, label: string, keys: string[]) => {
    if (keys.length) picks.push({ id, label, keys });
  };
  for (const id of ['part-a', 'part-b']) {
    const g = findGroup(root, id);
    if (g) add(id, g.label, readyKeysIn(g));
  }
  for (const d of findGroup(root, 'part-b/directors')?.groups ?? []) add(d.id, d.label, readyKeysIn(d));
  const after = findGroup(root, 'after');
  if (after) add('after', after.label, readyKeysIn(after));
  add(
    'uploaded',
    'Uploaded files only',
    publicFilesIn(root)
      .filter((f) => f.ready && f.kind === 'uploaded')
      .map((f) => f.key),
  );
  add('all', 'Everything', readyKeysIn(root));
  return picks;
}

/** The remembered choice, kept to the files this engagement has ready; everything when none fit. */
export function initialSelection(root: PublicDownloadGroup, remembered: readonly string[] | null): Set<string> {
  const ready = readyKeysIn(root);
  const kept = remembered ? ready.filter((k) => remembered.includes(k)) : [];
  return new Set(kept.length ? kept : ready);
}
