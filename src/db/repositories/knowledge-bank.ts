import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { knowledgeBankFiles, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';

/**
 * KNOWLEDGE BANK REPOSITORY.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Reproduces 20260529160000_knowledge_bank.sql:
 *
 * Four-role (firm-wide table, not engagement-scoped):
 *   admin/manager: read + write + delete (old manager_all)
 *   intern: read ALL + insert own (uploaded_by = self)
 *   client: none
 */

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
}

type Row = typeof knowledgeBankFiles.$inferSelect;

function mapRow(row: Row, uploader: { name: string | null; email: string } | null): KnowledgeBankFileDto {
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
  };
}

function canRead(ctx: AuthContext): boolean {
  return ctx.role === 'admin' || ctx.role === 'manager' || ctx.role === 'intern';
}

export async function listKnowledgeBankFiles(
  ctx: AuthContext,
  limit = 200,
): Promise<KnowledgeBankFileDto[]> {
  if (!canRead(ctx)) return [];

  const rows = await db
    .select({ file: knowledgeBankFiles, uploader: { name: profiles.name, email: profiles.email } })
    .from(knowledgeBankFiles)
    .leftJoin(profiles, eq(profiles.id, knowledgeBankFiles.uploadedBy))
    .orderBy(desc(knowledgeBankFiles.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));

  return rows.map((r) => mapRow(r.file, r.uploader));
}

export async function getKnowledgeBankFile(
  ctx: AuthContext,
  id: string,
): Promise<KnowledgeBankFileDto | null> {
  if (!canRead(ctx)) return null;

  const [row] = await db
    .select({ file: knowledgeBankFiles, uploader: { name: profiles.name, email: profiles.email } })
    .from(knowledgeBankFiles)
    .leftJoin(profiles, eq(profiles.id, knowledgeBankFiles.uploadedBy))
    .where(eq(knowledgeBankFiles.id, id))
    .limit(1);

  return row ? mapRow(row.file, row.uploader) : null;
}

/** Internal: the storage path, needed to sign or delete the underlying object. */
export async function getKnowledgeBankStoragePath(
  ctx: AuthContext,
  id: string,
): Promise<string | null> {
  if (!canRead(ctx)) return null;
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
  if (!canRead(ctx)) {
    throw new Error('Not permitted to add knowledge bank files');
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
    })
    .returning();

  return mapRow(row, { name: ctx.name ?? null, email: ctx.email });
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
  if (ctx.role !== 'admin' && ctx.role !== 'manager') {
    throw new Error('Only admins or managers may delete knowledge bank files');
  }

  const [row] = await db
    .delete(knowledgeBankFiles)
    .where(eq(knowledgeBankFiles.id, id))
    .returning({ storagePath: knowledgeBankFiles.storagePath });

  return row?.storagePath ?? null;
}
