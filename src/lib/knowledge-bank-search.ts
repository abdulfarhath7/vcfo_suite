/** Firm-library search helpers. KB is not per-company; location is folder path. */

export type KnowledgeBankSearchFile = {
  title: string;
  fileName: string;
  description?: string | null;
  folderPath?: string | null;
};

export function knowledgeBankFileMatchesQuery(
  file: KnowledgeBankSearchFile,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    file.fileName.toLowerCase().includes(q) ||
    file.title.toLowerCase().includes(q) ||
    (file.description?.toLowerCase().includes(q) ?? false) ||
    (file.folderPath?.toLowerCase().includes(q) ?? false)
  );
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
