/** Firm-library search helpers. KB is not per-company; location is folder path. */

export type KnowledgeBankSearchFile = {
  id?: string;
  title: string;
  fileName: string;
  description?: string | null;
  folderPath?: string | null;
};

function includesQuery(value: string | null | undefined, q: string): boolean {
  return (value ?? '').toLowerCase().includes(q);
}

export function knowledgeBankFileMatchesQuery(
  file: KnowledgeBankSearchFile,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    includesQuery(file.fileName, q) ||
    includesQuery(file.title, q) ||
    includesQuery(file.description, q) ||
    includesQuery(file.folderPath, q)
  );
}

/** GET /api/knowledge-bank returns `{ ok, files, folders, tree }`. Older clients sent a bare file array. */
export function knowledgeBankFilesFromResponse(payload: unknown): KnowledgeBankSearchFile[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (row): row is KnowledgeBankSearchFile =>
        Boolean(row) && typeof row === 'object' && typeof (row as KnowledgeBankSearchFile).fileName === 'string',
    );
  }
  if (!payload || typeof payload !== 'object') return [];
  const files = (payload as { files?: unknown }).files;
  return Array.isArray(files) ? knowledgeBankFilesFromResponse(files) : [];
}

export function knowledgeBankLocationLabel(
  file: Pick<KnowledgeBankSearchFile, 'folderPath'>,
): string {
  const path = file.folderPath?.trim();
  return path ? path : 'Knowledge Bank';
}

/** Command palette line: `GSTR-1.pdf — Knowledge Bank · Policies / GST`. */
export function formatKnowledgeBankCommandHit(file: KnowledgeBankSearchFile): string {
  const path = file.folderPath?.trim();
  if (!path) return `${file.fileName} — Knowledge Bank`;
  return `${file.fileName} — Knowledge Bank · ${path}`;
}
