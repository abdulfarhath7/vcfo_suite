import 'server-only';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { knowledgeBankFiles, knowledgeBankFolders, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import {
  buildKnowledgeBankTree,
  canDeleteKnowledgeBank,
  canInsertKnowledgeBank,
  canNestKnowledgeBankFolder,
  canReadKnowledgeBank,
  isKnowledgeBankFolderEmpty,
  knowledgeBankChildFolders,
  knowledgeBankFilesInFolder,
  knowledgeBankFolderAncestors,
  knowledgeBankFolderPath,
  knowledgeBankSiblingNameTaken,
  normalizeKnowledgeBankFolderName,
  type KnowledgeBankFolderNode,
  type KnowledgeBankFolderRecord,
} from '@/lib/knowledge-bank-folders';

/**
 * KNOWLEDGE BANK REPOSITORY.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Reproduces 20260529160000_knowledge_bank.sql plus 0013 folders:
 *
 * Four-role (firm-wide table, not engagement-scoped):
 *   admin/manager: read + write + delete (old manager_all)
 *   intern: read ALL + insert own (uploaded_by / created_by = self)
 *   intern cannot delete files or folders
 *   client: none
 *
 * Folder delete: refuse non-empty (child folders or files). FKs are
 * ON DELETE restrict. Empty the folder first — no cascade.
 */

export interface KnowledgeBankFolderDto {
  id: string;
  parentId: string | null;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface KnowledgeBankFileDto {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploaderName: string | null;
  uploaderEmail: string | null;
  createdAt: string;
  folderId: string | null;
  /** Breadcrumb path for CommandPalette / global search. Root → "". */
  folderPath: string;
}

export interface KnowledgeBankLibraryDto {
  files: KnowledgeBankFileDto[];
  folders: KnowledgeBankFolderDto[];
  tree: KnowledgeBankFolderNode[];
}

export interface KnowledgeBankFolderChildrenDto {
  folderId: string | null;
  folder: KnowledgeBankFolderDto | null;
  ancestors: KnowledgeBankFolderDto[];
  folders: KnowledgeBankFolderDto[];
  files: KnowledgeBankFileDto[];
}

type FileRow = typeof knowledgeBankFiles.$inferSelect;
type FolderRow = typeof knowledgeBankFolders.$inferSelect;

function mapFolder(row: FolderRow): KnowledgeBankFolderDto {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapFile(
  row: FileRow,
  uploader: { name: string | null; email: string } | null,
  folders: readonly KnowledgeBankFolderRecord[],
): KnowledgeBankFileDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    uploaderName: uploader?.name ?? null,
    uploaderEmail: uploader?.email ?? null,
    createdAt: row.createdAt.toISOString(),
    folderId: row.folderId,
    folderPath: knowledgeBankFolderPath(row.folderId, folders),
  };
}

function assertCanRead(ctx: AuthContext): void {
  if (!canReadKnowledgeBank(ctx.role)) {
    throw new Error('Not permitted to access the knowledge bank');
  }
}

function assertCanInsert(ctx: AuthContext): void {
  if (!canInsertKnowledgeBank(ctx.role)) {
    throw new Error('Not permitted to add knowledge bank files');
  }
}

function assertCanDelete(ctx: AuthContext, kind: 'files' | 'folders'): void {
  if (!canDeleteKnowledgeBank(ctx.role)) {
    throw new Error(`Only admins or managers may delete knowledge bank ${kind}`);
  }
}

async function loadFolders(): Promise<KnowledgeBankFolderDto[]> {
  const rows = await db
    .select()
    .from(knowledgeBankFolders)
    .orderBy(asc(knowledgeBankFolders.name));
  return rows.map(mapFolder);
}

export async function listKnowledgeBankLibrary(
  ctx: AuthContext,
  limit = 200,
): Promise<KnowledgeBankLibraryDto> {
  if (!canReadKnowledgeBank(ctx.role)) {
    return { files: [], folders: [], tree: [] };
  }

  const folders = await loadFolders();
  const rows = await db
    .select({ file: knowledgeBankFiles, uploader: { name: profiles.name, email: profiles.email } })
    .from(knowledgeBankFiles)
    .leftJoin(profiles, eq(profiles.id, knowledgeBankFiles.uploadedBy))
    .orderBy(desc(knowledgeBankFiles.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));

  const files = rows.map((r) => mapFile(r.file, r.uploader, folders));
  return { files, folders, tree: buildKnowledgeBankTree(folders) };
}

export async function listKnowledgeBankFolderChildren(
  ctx: AuthContext,
  folderId: string | null,
): Promise<KnowledgeBankFolderChildrenDto | null> {
  if (!canReadKnowledgeBank(ctx.role)) {
    return { folderId, folder: null, ancestors: [], folders: [], files: [] };
  }

  const library = await listKnowledgeBankLibrary(ctx);
  if (folderId) {
    const folder = library.folders.find((row) => row.id === folderId) ?? null;
    if (!folder) return null;
    return {
      folderId,
      folder,
      ancestors: knowledgeBankFolderAncestors(folderId, library.folders),
      folders: knowledgeBankChildFolders(folderId, library.folders),
      files: knowledgeBankFilesInFolder(folderId, library.files),
    };
  }

  return {
    folderId: null,
    folder: null,
    ancestors: [],
    folders: knowledgeBankChildFolders(null, library.folders),
    files: knowledgeBankFilesInFolder(null, library.files),
  };
}

export async function listKnowledgeBankFiles(
  ctx: AuthContext,
  limit = 200,
): Promise<KnowledgeBankFileDto[]> {
  const library = await listKnowledgeBankLibrary(ctx, limit);
  return library.files;
}

export async function getKnowledgeBankFile(
  ctx: AuthContext,
  id: string,
): Promise<KnowledgeBankFileDto | null> {
  if (!canReadKnowledgeBank(ctx.role)) return null;

  const folders = await loadFolders();
  const [row] = await db
    .select({ file: knowledgeBankFiles, uploader: { name: profiles.name, email: profiles.email } })
    .from(knowledgeBankFiles)
    .leftJoin(profiles, eq(profiles.id, knowledgeBankFiles.uploadedBy))
    .where(eq(knowledgeBankFiles.id, id))
    .limit(1);

  return row ? mapFile(row.file, row.uploader, folders) : null;
}

export async function getKnowledgeBankFolder(
  ctx: AuthContext,
  id: string,
): Promise<KnowledgeBankFolderDto | null> {
  if (!canReadKnowledgeBank(ctx.role)) return null;
  const [row] = await db
    .select()
    .from(knowledgeBankFolders)
    .where(eq(knowledgeBankFolders.id, id))
    .limit(1);
  return row ? mapFolder(row) : null;
}

/** Internal: the storage path, needed to sign or delete the underlying object. */
export async function getKnowledgeBankStoragePath(
  ctx: AuthContext,
  id: string,
): Promise<string | null> {
  if (!canReadKnowledgeBank(ctx.role)) return null;
  const [row] = await db
    .select({ storagePath: knowledgeBankFiles.storagePath })
    .from(knowledgeBankFiles)
    .where(eq(knowledgeBankFiles.id, id))
    .limit(1);
  return row?.storagePath ?? null;
}

export interface RegisterKnowledgeBankFileInput {
  id: string;
  title: string;
  description?: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  folderId?: string | null;
}

/**
 * Register an already-uploaded object. `uploaded_by` is forced to the session
 * user — that was the intern INSERT policy's WITH CHECK clause, and a caller
 * must not be able to attribute an upload to someone else.
 */
export async function registerKnowledgeBankFile(
  ctx: AuthContext,
  input: RegisterKnowledgeBankFileInput,
): Promise<KnowledgeBankFileDto> {
  assertCanInsert(ctx);

  const folderId = input.folderId?.trim() || null;
  if (folderId) {
    const folder = await getKnowledgeBankFolder(ctx, folderId);
    if (!folder) {
      throw new Error('parent_not_found');
    }
  }

  const [row] = await db
    .insert(knowledgeBankFiles)
    .values({
      id: input.id,
      title: input.title,
      description: input.description?.trim() || null,
      storagePath: input.storagePath.trim(),
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedBy: ctx.userId,
      folderId,
    })
    .returning();

  const folders = await loadFolders();
  return mapFile(row, { name: ctx.name ?? null, email: ctx.email }, folders);
}

export interface CreateKnowledgeBankFolderInput {
  name: string;
  parentId?: string | null;
}

export async function createKnowledgeBankFolder(
  ctx: AuthContext,
  input: CreateKnowledgeBankFolderInput,
): Promise<KnowledgeBankFolderDto> {
  assertCanInsert(ctx);

  const name = normalizeKnowledgeBankFolderName(input.name);
  if (!name) {
    throw new Error('invalid_folder_name');
  }

  const parentId = input.parentId?.trim() || null;
  const folders = await loadFolders();

  if (parentId) {
    const parent = folders.find((folder) => folder.id === parentId);
    if (!parent) {
      throw new Error('parent_not_found');
    }
    if (!canNestKnowledgeBankFolder(parentId, folders)) {
      throw new Error('folder_too_deep');
    }
  }

  if (knowledgeBankSiblingNameTaken(name, parentId, folders)) {
    throw new Error('duplicate_folder_name');
  }

  const [row] = await db
    .insert(knowledgeBankFolders)
    .values({
      name,
      parentId,
      createdBy: ctx.userId,
    })
    .returning();

  return mapFolder(row);
}

/**
 * Admin/manager delete (interns had SELECT + INSERT but no DELETE). Returns
 * the storage path of the removed row so the caller can delete the S3 object
 * too, or null if nothing was deleted.
 */
export async function deleteKnowledgeBankFile(
  ctx: AuthContext,
  id: string,
): Promise<string | null> {
  assertCanDelete(ctx, 'files');

  const [row] = await db
    .delete(knowledgeBankFiles)
    .where(eq(knowledgeBankFiles.id, id))
    .returning({ storagePath: knowledgeBankFiles.storagePath });

  return row?.storagePath ?? null;
}

/**
 * Delete an empty folder only. Non-empty folders are refused (no cascade).
 * Interns cannot delete folders.
 */
export async function deleteKnowledgeBankFolder(
  ctx: AuthContext,
  id: string,
): Promise<boolean> {
  assertCanDelete(ctx, 'folders');
  assertCanRead(ctx);

  const library = await listKnowledgeBankLibrary(ctx);
  const folder = library.folders.find((row) => row.id === id);
  if (!folder) return false;

  if (!isKnowledgeBankFolderEmpty(id, library.folders, library.files)) {
    throw new Error('folder_not_empty');
  }

  const [row] = await db
    .delete(knowledgeBankFolders)
    .where(eq(knowledgeBankFolders.id, id))
    .returning({ id: knowledgeBankFolders.id });

  return Boolean(row);
}
