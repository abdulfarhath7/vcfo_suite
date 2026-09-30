import 'server-only';

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { assistChunks, assistDocuments } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { AssistForbiddenError, assertAssistRole } from '@/lib/assist/access';

/**
 * ASSIST KNOWLEDGE SOURCES.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Upload, list and status changes: admin / super admin only.
 * Retrieval (`searchAssistChunks`) is open to every Assist role but filters by
 * audience: a client-persona search only ever sees `client` / `both` sources,
 * so staff-only notes never reach a client answer. Only `ready` documents are
 * searched.
 *
 * `system*` functions are for the ingestion job (no user context) and must
 * never be called from a route.
 */

export type AssistDocumentRow = typeof assistDocuments.$inferSelect;
export type AssistDocumentAudience = 'client' | 'staff' | 'both';
export type AssistSourceType = 'govt' | 'firm_pdf' | 'firm_note';

function assertSourceAdmin(ctx: AuthContext) {
  assertAssistRole(ctx);
  if (!isFirmWideAdmin(ctx.role)) throw new AssistForbiddenError('Only firm admins manage Assist sources');
}

export interface CreateAssistDocumentInput {
  title: string;
  sourceType: AssistSourceType;
  sourceUrl?: string | null;
  s3Key?: string | null;
  effectiveFrom?: string | null;
  audience: AssistDocumentAudience;
}

export async function createAssistDocument(
  ctx: AuthContext,
  input: CreateAssistDocumentInput,
): Promise<AssistDocumentRow> {
  assertSourceAdmin(ctx);
  const [row] = await db
    .insert(assistDocuments)
    .values({
      title: input.title.trim(),
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      s3Key: input.s3Key ?? null,
      effectiveFrom: input.effectiveFrom ?? null,
      audience: input.audience,
      ownerProfileId: ctx.userId,
      status: 'processing',
      lastVerifiedAt: new Date(),
    })
    .returning();
  if (!row) throw new Error('Could not save the source');
  return row;
}

export async function listAssistDocuments(ctx: AuthContext): Promise<AssistDocumentRow[]> {
  assertSourceAdmin(ctx);
  return db.select().from(assistDocuments).orderBy(desc(assistDocuments.createdAt));
}

export async function getAssistDocument(ctx: AuthContext, id: string): Promise<AssistDocumentRow | null> {
  assertSourceAdmin(ctx);
  const [row] = await db.select().from(assistDocuments).where(eq(assistDocuments.id, id)).limit(1);
  return row ?? null;
}

export async function setAssistDocumentStatus(
  ctx: AuthContext,
  id: string,
  status: 'processing' | 'archived',
): Promise<AssistDocumentRow | null> {
  assertSourceAdmin(ctx);
  const [row] = await db
    .update(assistDocuments)
    .set({ status, error: null })
    .where(eq(assistDocuments.id, id))
    .returning();
  return row ?? null;
}

// ---------- Ingestion job (system) ----------

export async function systemGetAssistDocument(id: string): Promise<AssistDocumentRow | null> {
  const [row] = await db.select().from(assistDocuments).where(eq(assistDocuments.id, id)).limit(1);
  return row ?? null;
}

/** Replace every chunk of a document — re-running ingestion is idempotent. */
export async function systemReplaceAssistChunks(
  documentId: string,
  chunks: Array<{ ordinal: number; text: string; contextPrefix: string | null }>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(assistChunks).where(eq(assistChunks.documentId, documentId));
    if (chunks.length > 0) {
      await tx.insert(assistChunks).values(chunks.map((c) => ({ documentId, ...c })));
    }
  });
}

export async function systemSetAssistDocumentResult(
  documentId: string,
  result: { status: 'ready' } | { status: 'failed'; error: string },
): Promise<void> {
  await db
    .update(assistDocuments)
    .set(
      result.status === 'ready'
        ? { status: 'ready', error: null, lastVerifiedAt: new Date() }
        : { status: 'failed', error: result.error.slice(0, 2000) },
    )
    .where(eq(assistDocuments.id, documentId));
}

// ---------- Retrieval ----------

export interface AssistChunkHit {
  id: string;
  documentId: string;
  documentTitle: string;
  sourceType: string;
  sourceUrl: string | null;
  text: string;
  contextPrefix: string | null;
  rank: number;
}

/** Audiences a persona may read. Client persona never sees staff-only sources. */
export function audiencesForPersona(persona: 'client' | 'staff'): AssistDocumentAudience[] {
  return persona === 'client' ? ['client', 'both'] : ['client', 'staff', 'both'];
}

export async function searchAssistChunks(
  ctx: AuthContext,
  input: { query: string; persona: 'client' | 'staff'; limit: number },
): Promise<AssistChunkHit[]> {
  assertAssistRole(ctx);
  // A client can never widen their persona to staff.
  const persona = ctx.role === 'client' ? 'client' : input.persona;
  const query = input.query.trim();
  if (!query) return [];
  const tsQuery = sql`websearch_to_tsquery('english', ${query})`;
  const rank = sql<number>`ts_rank(${assistChunks.tsv}, ${tsQuery})`;
  const rows = await db
    .select({
      id: assistChunks.id,
      documentId: assistChunks.documentId,
      documentTitle: assistDocuments.title,
      sourceType: assistDocuments.sourceType,
      sourceUrl: assistDocuments.sourceUrl,
      text: assistChunks.text,
      contextPrefix: assistChunks.contextPrefix,
      rank,
    })
    .from(assistChunks)
    .innerJoin(assistDocuments, eq(assistDocuments.id, assistChunks.documentId))
    .where(
      and(
        eq(assistDocuments.status, 'ready'),
        inArray(assistDocuments.audience, audiencesForPersona(persona)),
        sql`${assistChunks.tsv} @@ ${tsQuery}`,
      ),
    )
    .orderBy(desc(rank))
    .limit(Math.max(1, Math.min(input.limit, 20)));
  return rows.map((r) => ({ ...r, rank: Number(r.rank) }));
}
