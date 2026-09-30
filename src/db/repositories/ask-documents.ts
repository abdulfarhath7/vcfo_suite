import 'server-only';

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { askChunks, askDocuments } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { AskForbiddenError, assertAskRole } from '@/lib/ask/access';

/**
 * ASK VCFO KNOWLEDGE SOURCES.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Upload, list and status changes: admin / super admin only.
 * Retrieval (`searchAskChunks`) is open to every Ask VCFO role but filters by
 * audience: a client-persona search only ever sees `client` / `both` sources,
 * so staff-only notes never reach a client answer. Only `ready` documents are
 * searched.
 *
 * `system*` functions are for the ingestion job (no user context) and must
 * never be called from a route.
 */

export type AskDocumentRow = typeof askDocuments.$inferSelect;
export type AskDocumentAudience = 'client' | 'staff' | 'both';
export type AskSourceType = 'govt' | 'firm_pdf' | 'firm_note';

function assertSourceAdmin(ctx: AuthContext) {
  assertAskRole(ctx);
  if (!isFirmWideAdmin(ctx.role)) throw new AskForbiddenError('Only firm admins manage Ask VCFO sources');
}

export interface CreateAskDocumentInput {
  title: string;
  sourceType: AskSourceType;
  sourceUrl?: string | null;
  s3Key?: string | null;
  effectiveFrom?: string | null;
  audience: AskDocumentAudience;
}

export async function createAskDocument(
  ctx: AuthContext,
  input: CreateAskDocumentInput,
): Promise<AskDocumentRow> {
  assertSourceAdmin(ctx);
  const [row] = await db
    .insert(askDocuments)
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

export async function listAskDocuments(ctx: AuthContext): Promise<AskDocumentRow[]> {
  assertSourceAdmin(ctx);
  return db.select().from(askDocuments).orderBy(desc(askDocuments.createdAt));
}

export async function getAskDocument(ctx: AuthContext, id: string): Promise<AskDocumentRow | null> {
  assertSourceAdmin(ctx);
  const [row] = await db.select().from(askDocuments).where(eq(askDocuments.id, id)).limit(1);
  return row ?? null;
}

export async function setAskDocumentStatus(
  ctx: AuthContext,
  id: string,
  status: 'processing' | 'archived',
): Promise<AskDocumentRow | null> {
  assertSourceAdmin(ctx);
  const [row] = await db
    .update(askDocuments)
    .set({ status, error: null })
    .where(eq(askDocuments.id, id))
    .returning();
  return row ?? null;
}

export async function setAskDocumentStorageKey(ctx: AuthContext, id: string, s3Key: string): Promise<void> {
  assertSourceAdmin(ctx);
  await db.update(askDocuments).set({ s3Key }).where(eq(askDocuments.id, id));
}

// ---------- Ingestion job (system) ----------

export async function systemGetAskDocument(id: string): Promise<AskDocumentRow | null> {
  const [row] = await db.select().from(askDocuments).where(eq(askDocuments.id, id)).limit(1);
  return row ?? null;
}

/** Replace every chunk of a document — re-running ingestion is idempotent. */
export async function systemReplaceAskChunks(
  documentId: string,
  chunks: Array<{ ordinal: number; text: string; contextPrefix: string | null }>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(askChunks).where(eq(askChunks.documentId, documentId));
    if (chunks.length > 0) {
      await tx.insert(askChunks).values(chunks.map((c) => ({ documentId, ...c })));
    }
  });
}

export async function systemSetAskDocumentResult(
  documentId: string,
  result: { status: 'ready' } | { status: 'failed'; error: string },
): Promise<void> {
  await db
    .update(askDocuments)
    .set(
      result.status === 'ready'
        ? { status: 'ready', error: null, lastVerifiedAt: new Date() }
        : { status: 'failed', error: result.error.slice(0, 2000) },
    )
    .where(eq(askDocuments.id, documentId));
}

// ---------- Retrieval ----------

export interface AskChunkHit {
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
export function audiencesForPersona(persona: 'client' | 'staff'): AskDocumentAudience[] {
  return persona === 'client' ? ['client', 'both'] : ['client', 'staff', 'both'];
}

export async function searchAskChunks(
  ctx: AuthContext,
  input: { query: string; persona: 'client' | 'staff'; limit: number },
): Promise<AskChunkHit[]> {
  assertAskRole(ctx);
  // A client can never widen their persona to staff.
  const persona = ctx.role === 'client' ? 'client' : input.persona;
  const query = input.query.trim();
  if (!query) return [];
  const tsQuery = sql`websearch_to_tsquery('english', ${query})`;
  const rank = sql<number>`ts_rank(${askChunks.tsv}, ${tsQuery})`;
  const rows = await db
    .select({
      id: askChunks.id,
      documentId: askChunks.documentId,
      documentTitle: askDocuments.title,
      sourceType: askDocuments.sourceType,
      sourceUrl: askDocuments.sourceUrl,
      text: askChunks.text,
      contextPrefix: askChunks.contextPrefix,
      rank,
    })
    .from(askChunks)
    .innerJoin(askDocuments, eq(askDocuments.id, askChunks.documentId))
    .where(
      and(
        eq(askDocuments.status, 'ready'),
        inArray(askDocuments.audience, audiencesForPersona(persona)),
        sql`${askChunks.tsv} @@ ${tsQuery}`,
      ),
    )
    .orderBy(desc(rank))
    .limit(Math.max(1, Math.min(input.limit, 20)));
  return rows.map((r) => ({ ...r, rank: Number(r.rank) }));
}
