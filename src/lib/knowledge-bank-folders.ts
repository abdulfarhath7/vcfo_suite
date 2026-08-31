/**
 * Pure Knowledge Bank folder helpers (no db). Tree + Path A write/delete rules.
 *
 * Delete policy: refuse non-empty folders (child folders or files). Cascade is
 * not used — empty the folder first. Interns cannot delete folders or files.
 */

export const KNOWLEDGE_BANK_MAX_FOLDER_DEPTH = 12;
export const KNOWLEDGE_BANK_FOLDER_NAME_MAX = 80;

export type KnowledgeBankFolderRecord = {
  id: string;
  parentId: string | null;
  name: string;
  createdBy: string;
  createdAt: string;
};

export type KnowledgeBankFolderNode = KnowledgeBankFolderRecord & {
  children: KnowledgeBankFolderNode[];
};

export type KnowledgeBankFileLocation = {
  id: string;
  folderId: string | null;
};

export function canReadKnowledgeBank(role: string | undefined): boolean {
  return (
    role === 'super_admin' || role === 'admin' || role === 'manager' || role === 'intern'
  );
}

/** Admin/manager write+delete; intern insert own; client none. */
export function canInsertKnowledgeBank(role: string | undefined): boolean {
  return canReadKnowledgeBank(role);
}

export function canDeleteKnowledgeBank(role: string | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'super_admin';
}

export function normalizeKnowledgeBankFolderName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return null;
  if (name.length > KNOWLEDGE_BANK_FOLDER_NAME_MAX) return null;
  // eslint-disable-next-line no-control-regex -- control characters are what this rejects
  if (/[/\\]/.test(name) || /[\u0000-\u001f]/.test(name)) return null;
  return name;
}

export function knowledgeBankFolderAncestors(
  folderId: string | null,
  folders: readonly KnowledgeBankFolderRecord[],
): KnowledgeBankFolderRecord[] {
  if (!folderId) return [];
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const chain: KnowledgeBankFolderRecord[] = [];
  const seen = new Set<string>();
  let current: string | null = folderId;
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    const folder = byId.get(current);
    if (!folder) break;
    chain.push(folder);
    current = folder.parentId;
  }
  return chain.reverse();
}

/** Display path for a folder (or a file in that folder). Root → "". */
export function knowledgeBankFolderPath(
  folderId: string | null,
  folders: readonly KnowledgeBankFolderRecord[],
): string {
  return knowledgeBankFolderAncestors(folderId, folders)
    .map((folder) => folder.name)
    .join(' / ');
}

export function knowledgeBankFolderDepth(
  folderId: string | null,
  folders: readonly KnowledgeBankFolderRecord[],
): number {
  if (!folderId) return 0;
  return knowledgeBankFolderAncestors(folderId, folders).length;
}

export function canNestKnowledgeBankFolder(
  parentId: string | null,
  folders: readonly KnowledgeBankFolderRecord[],
): boolean {
  return knowledgeBankFolderDepth(parentId, folders) < KNOWLEDGE_BANK_MAX_FOLDER_DEPTH;
}

export function wouldCreateKnowledgeBankCycle(
  folderId: string,
  nextParentId: string | null,
  folders: readonly KnowledgeBankFolderRecord[],
): boolean {
  if (!nextParentId) return false;
  if (nextParentId === folderId) return true;
  return knowledgeBankFolderAncestors(nextParentId, folders).some((folder) => folder.id === folderId);
}

export function buildKnowledgeBankTree(
  folders: readonly KnowledgeBankFolderRecord[],
): KnowledgeBankFolderNode[] {
  const byId = new Map<string, KnowledgeBankFolderNode>();
  for (const folder of folders) {
    byId.set(folder.id, { ...folder, children: [] });
  }

  const roots: KnowledgeBankFolderNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: KnowledgeBankFolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);
  return roots;
}

export function knowledgeBankChildFolders(
  parentId: string | null,
  folders: readonly KnowledgeBankFolderRecord[],
): KnowledgeBankFolderRecord[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export function knowledgeBankFilesInFolder<T extends KnowledgeBankFileLocation>(
  folderId: string | null,
  files: readonly T[],
): T[] {
  return files.filter((file) => file.folderId === folderId);
}

export function isKnowledgeBankFolderEmpty(
  folderId: string,
  folders: readonly KnowledgeBankFolderRecord[],
  files: readonly KnowledgeBankFileLocation[],
): boolean {
  const hasChildFolder = folders.some((folder) => folder.parentId === folderId);
  const hasFile = files.some((file) => file.folderId === folderId);
  return !hasChildFolder && !hasFile;
}

export function knowledgeBankSiblingNameTaken(
  name: string,
  parentId: string | null,
  folders: readonly KnowledgeBankFolderRecord[],
  exceptId?: string,
): boolean {
  const needle = name.trim().toLowerCase();
  return folders.some(
    (folder) =>
      folder.parentId === parentId &&
      folder.id !== exceptId &&
      folder.name.trim().toLowerCase() === needle,
  );
}
