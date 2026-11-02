/**
 * Safe, unique paths for entries inside a ZIP. Each segment loses path separators, control
 * characters and the characters Windows refuses, a "." or ".." segment is dropped, so no entry
 * can climb out of the folder it is unpacked into, and a repeated path gets " (2)", " (3)" ...
 * before its extension.
 */

// eslint-disable-next-line no-control-regex -- control characters are what this strips
const UNSAFE = /[\u0000-\u001f\u007f<>:"|?*\\/]+/g;

/** One path segment, cleaned. Returns an empty string when nothing usable is left. */
export function cleanZipSegment(segment: string): string {
  const cleaned = segment.replace(UNSAFE, '_').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (cleaned === '.' || cleaned === '..') return '';
  return cleaned.replace(/^\.+$/, '');
}

/** Join an optional folder (which may hold "/" between levels) and a file name. */
export function zipEntryPath(folder: string | null | undefined, fileName: string): string {
  const folders = (folder ?? '')
    .split('/')
    .map(cleanZipSegment)
    .filter(Boolean)
    .slice(0, 4);
  const file = cleanZipSegment(fileName.split(/[/\\]/).pop() ?? '') || 'file';
  return [...folders, file].join('/');
}

/** Hands out each path once, numbering repeats ("a.pdf", "a (2).pdf"). Case-insensitive. */
export function createUniqueNamer(): (path: string) => string {
  const used = new Set<string>();
  return (path: string) => {
    if (!used.has(path.toLowerCase())) {
      used.add(path.toLowerCase());
      return path;
    }
    const slash = path.lastIndexOf('/');
    const dir = slash >= 0 ? path.slice(0, slash + 1) : '';
    const base = path.slice(slash + 1);
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    for (let n = 2; ; n++) {
      const candidate = `${dir}${stem} (${n})${ext}`;
      if (!used.has(candidate.toLowerCase())) {
        used.add(candidate.toLowerCase());
        return candidate;
      }
    }
  };
}

/** A file name for the archive itself ("Acme documents.zip"). */
export function zipArchiveName(label: string | null | undefined): string {
  const base = cleanZipSegment(label ?? '').replace(/\.zip$/i, '') || 'documents';
  return `${base}.zip`;
}
