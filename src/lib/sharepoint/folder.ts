import { dropFileRefusal, isZipName } from '@/lib/ask/drop/extensions';
import { cleanZipPath, ZIP_ENTRY_MAX_BYTES } from '@/lib/ask/drop/unzip';
import { DROP_MAX_BYTES, DROP_MAX_FILES } from '@/lib/upload-limits';
import type { DriveItem } from './graph';

/**
 * Walks one client's SharePoint folder and decides, before anything is downloaded, which files the
 * drop takes. It keeps the drop's own limits: 50 files, 200 MB in all, 25 MB a file, the same file
 * types a drop reads. Sub-folders are walked depth first, in name order, at most eight levels deep.
 * System files (dotfiles, Thumbs.db) are left out without a word, as the ZIP reader does. A file an
 * earlier fetch already read, with the same content tag, is only counted, so the 50 go to new files.
 *
 * Pure apart from `listChildren`, which the caller backs with Graph (or a fake in tests).
 */

export interface WalkLimits {
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes: number;
  maxDepth: number;
}

export const DEFAULT_WALK_LIMITS: WalkLimits = {
  maxFiles: DROP_MAX_FILES,
  maxTotalBytes: DROP_MAX_BYTES,
  maxFileBytes: ZIP_ENTRY_MAX_BYTES,
  maxDepth: 8,
};

export interface WalkFile {
  itemId: string;
  name: string;
  /** The path inside the client folder, with forward slashes. */
  path: string;
  size: number;
  cTag: string | null;
}

export interface WalkSkip {
  itemId: string;
  path: string;
  size: number;
  reason: string;
}

export const TOO_MANY_FILES = 'Left out for now: a fetch takes 50 files. Ask again for the next ones.';
export const TOO_LARGE_TOTAL = 'Left out: the folder holds more than 200 MB.';
export const TOO_LARGE_FILE = 'Left out: the file is larger than 25 MB.';
export const NOT_A_FILE = 'Left out: this is a OneNote notebook or a link, not a file.';
export const TOO_DEEP = 'Left out: the folder is nested too deep.';

export async function walkFolder(
  listChildren: (itemId: string) => Promise<DriveItem[]>,
  rootId: string,
  limits: WalkLimits = DEFAULT_WALK_LIMITS,
  /** True for a file an earlier fetch already read, unchanged: it is left out and only counted. */
  isSeen: (item: DriveItem) => boolean = () => false,
): Promise<{ files: WalkFile[]; skipped: WalkSkip[]; alreadySeen: number }> {
  const files: WalkFile[] = [];
  const skipped: WalkSkip[] = [];
  let bytes = 0;
  let alreadySeen = 0;

  async function visit(itemId: string, prefix: string, depth: number): Promise<void> {
    const children = [...(await listChildren(itemId))].sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const path = prefix ? `${prefix}/${child.name}` : child.name;
      const cleaned = cleanZipPath(path);
      if (cleaned === 'ignore' || cleaned === null) continue;
      if (child.folder) {
        if (depth + 1 > limits.maxDepth) {
          skipped.push({ itemId: child.id, path, size: 0, reason: TOO_DEEP });
          continue;
        }
        await visit(child.id, path, depth + 1);
        continue;
      }
      const size = Number(child.size) || 0;
      if (child.package || !child.file) {
        skipped.push({ itemId: child.id, path, size, reason: NOT_A_FILE });
        continue;
      }
      const refusal = dropFileRefusal(child.name);
      if (refusal) {
        skipped.push({ itemId: child.id, path, size, reason: refusal });
        continue;
      }
      if (size > limits.maxFileBytes && !isZipName(child.name)) {
        skipped.push({ itemId: child.id, path, size, reason: TOO_LARGE_FILE });
        continue;
      }
      if (isSeen(child)) {
        alreadySeen += 1;
        continue;
      }
      if (files.length >= limits.maxFiles) {
        skipped.push({ itemId: child.id, path, size, reason: TOO_MANY_FILES });
        continue;
      }
      if (bytes + size > limits.maxTotalBytes) {
        skipped.push({ itemId: child.id, path, size, reason: TOO_LARGE_TOTAL });
        continue;
      }
      files.push({ itemId: child.id, name: child.name, path, size, cTag: child.cTag ?? null });
      bytes += size;
    }
  }

  await visit(rootId, '', 0);
  return { files, skipped, alreadySeen };
}
