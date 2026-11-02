import 'server-only';

import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
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

/**
 * How well the firm's sources cover a question: the number of the question's
 * search terms (English stems, stop words dropped) and the most of them any
 * one ready chunk the asker may read contains. Used to keep a question the
 * guard called off-topic when an uploaded document is about it. Same audience
 * rule as `searchAskChunks`.
 */
export async function askSourceCoverage(
  ctx: AuthContext,
  input: { query: string; persona: 'client' | 'staff' },
): Promise<{ terms: number; matched: number }> {
  assertAskRole(ctx);
  const persona = ctx.role === 'client' ? 'client' : input.persona;
  const query = input.query.trim();
  if (!query) return { terms: 0, matched: 0 };
  const lexemes = sql`tsvector_to_array(to_tsvector('english', ${query}))`;
  // One aggregate row; with no readable chunks both values come back null → 0.
  const [row] = await db
    .select({
      terms: sql<number>`coalesce(max(cardinality(${lexemes})), 0)::int`,
      matched: sql<number>`coalesce(max(cardinality(array(select unnest(tsvector_to_array(${askChunks.tsv})) intersect select unnest(${lexemes})))), 0)::int`,
    })
    .from(askChunks)
    .innerJoin(askDocuments, eq(askDocuments.id, askChunks.documentId))
    .where(and(eq(askDocuments.status, 'ready'), inArray(askDocuments.audience, audiencesForPersona(persona)), approvedForReading()));
  return { terms: Number(row?.terms ?? 0), matched: Number(row?.matched ?? 0) };
}

/** Indexed chunk count per document (admin / super admin), so the Sources page can show "read: n pieces". */
export async function countAskChunksByDocument(ctx: AuthContext): Promise<Map<string, number>> {
  assertSourceAdmin(ctx);
  const rows = await db
    .select({ documentId: askChunks.documentId, n: sql<number>`count(*)::int` })
    .from(askChunks)
    .groupBy(askChunks.documentId);
  return new Map(rows.map((r) => [r.documentId, Number(r.n)]));
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

// ---------- Official-update watchers (system: the daily job and the admin "check now") ----------

/** Which of these publisher ids does a watcher already have a source for? */
export async function systemKnownFeedExternalIds(feedId: string, externalIds: readonly string[]): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await db
    .select({ externalId: askDocuments.externalId })
    .from(askDocuments)
    .where(and(eq(askDocuments.feedId, feedId), inArray(askDocuments.externalId, [...externalIds])));
  return new Set(rows.map((r) => r.externalId).filter((v): v is string => Boolean(v)));
}

export interface CreateFeedDocumentInput {
  feedId: string;
  externalId: string;
  title: string;
  sourceUrl: string;
  publishedAt: string;
  audience: AskDocumentAudience;
}

/**
 * Save one new official update as a source (status `processing`; ingestion
 * fills the chunks). Returns null when another run saved the same item first —
 * the unique (feed_id, external_id) index is the race guard.
 */
export async function systemCreateFeedDocument(input: CreateFeedDocumentInput): Promise<AskDocumentRow | null> {
  const [row] = await db
    .insert(askDocuments)
    .values({
      title: input.title.trim().slice(0, 300),
      sourceType: 'govt',
      sourceUrl: input.sourceUrl,
      effectiveFrom: input.publishedAt,
      publishedAt: input.publishedAt,
      feedId: input.feedId,
      externalId: input.externalId,
      audience: input.audience,
      status: 'processing',
      // A watcher's find waits for a manager; nothing reads it until approved.
      reviewStatus: 'pending',
    })
    .onConflictDoNothing({ target: [askDocuments.feedId, askDocuments.externalId] })
    .returning();
  return row ?? null;
}

export async function systemSetAskDocumentStorageKey(id: string, s3Key: string): Promise<void> {
  await db.update(askDocuments).set({ s3Key }).where(eq(askDocuments.id, id));
}

export async function systemSetAskDocumentSummary(id: string, summary: string | null): Promise<void> {
  await db.update(askDocuments).set({ summary: summary?.slice(0, 1200) ?? null }).where(eq(askDocuments.id, id));
}

// ---------- Manager review of official updates ----------

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

/**
 * Only an admin upload or an approved official update may ever be read,
 * searched or listed. Every reader query ANDs this in, so a pending or
 * rejected update is invisible to the model and to every tool.
 */
function approvedForReading() {
  return or(isNull(askDocuments.feedId), eq(askDocuments.reviewStatus, 'approved'));
}

/** Managers decide; admins and super admins may look. */
function assertCanSeeReviews(ctx: AuthContext) {
  if (ctx.role !== 'manager' && !isFirmWideAdmin(ctx.role)) {
    throw new AskForbiddenError('Only managers and admins see regulatory updates');
  }
}

export interface RegulatoryUpdateRow {
  id: string;
  feedId: string;
  externalId: string | null;
  title: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  summary: string | null;
  status: string;
  error: string | null;
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  hasReviewPdf: boolean;
  chunkCount: number;
  createdAt: string;
}

function toRegulatoryUpdateRow(row: AskDocumentRow, chunkCount: number): RegulatoryUpdateRow {
  return {
    id: row.id,
    feedId: row.feedId ?? '',
    externalId: row.externalId,
    title: row.title,
    sourceUrl: row.sourceUrl,
    publishedAt: row.publishedAt,
    summary: row.summary,
    status: row.status,
    error: row.error,
    reviewStatus: (row.reviewStatus as ReviewStatus) ?? 'pending',
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    hasReviewPdf: Boolean(row.reviewPdfKey),
    chunkCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every official update the watchers found, newest first, optionally one review state. */
export async function listRegulatoryUpdates(
  ctx: AuthContext,
  input: { reviewStatus?: ReviewStatus; limit?: number } = {},
): Promise<RegulatoryUpdateRow[]> {
  assertCanSeeReviews(ctx);
  const rows = await db
    .select()
    .from(askDocuments)
    .where(
      and(
        sql`${askDocuments.feedId} is not null`,
        input.reviewStatus ? eq(askDocuments.reviewStatus, input.reviewStatus) : undefined,
      ),
    )
    .orderBy(desc(askDocuments.createdAt))
    .limit(Math.max(1, Math.min(input.limit ?? 100, 300)));
  if (rows.length === 0) return [];
  const counts = await db
    .select({ documentId: askChunks.documentId, n: sql<number>`count(*)::int` })
    .from(askChunks)
    .where(inArray(askChunks.documentId, rows.map((r) => r.id)))
    .groupBy(askChunks.documentId);
  const byDoc = new Map(counts.map((c) => [c.documentId, Number(c.n)]));
  return rows.map((r) => toRegulatoryUpdateRow(r, byDoc.get(r.id) ?? 0));
}

export async function getRegulatoryUpdate(ctx: AuthContext, id: string): Promise<(RegulatoryUpdateRow & { reviewPdfKey: string | null }) | null> {
  assertCanSeeReviews(ctx);
  const [row] = await db.select().from(askDocuments).where(and(eq(askDocuments.id, id), sql`${askDocuments.feedId} is not null`)).limit(1);
  return row ? { ...toRegulatoryUpdateRow(row, 0), reviewPdfKey: row.reviewPdfKey } : null;
}

/**
 * The manager's decision (owner, 2026-10-23: managers only). Approving opens
 * the update to every reader — staff and clients; rejecting keeps it out with
 * the manager's reason. A decision on an already decided update is refused so
 * two managers cannot flip it back and forth by accident.
 */
export async function reviewRegulatoryUpdate(
  ctx: AuthContext,
  id: string,
  decision: 'approve' | 'reject',
  note: string | null,
): Promise<RegulatoryUpdateRow> {
  if (ctx.role !== 'manager') throw new AskForbiddenError('Only a manager can approve or reject an official update');
  const [row] = await db
    .update(askDocuments)
    .set({
      reviewStatus: decision === 'approve' ? 'approved' : 'rejected',
      reviewedBy: ctx.userId,
      reviewedAt: new Date(),
      reviewNote: note?.trim().slice(0, 2000) || null,
      ...(decision === 'approve' ? { audience: 'both' as const } : {}),
    })
    .where(and(eq(askDocuments.id, id), sql`${askDocuments.feedId} is not null`, eq(askDocuments.reviewStatus, 'pending')))
    .returning();
  if (!row) throw new Error('This update is not waiting for review.');
  return toRegulatoryUpdateRow(row, 0);
}

export async function systemSetAskDocumentReviewPdf(id: string, key: string): Promise<void> {
  await db.update(askDocuments).set({ reviewPdfKey: key }).where(eq(askDocuments.id, id));
}

export interface RecentOfficialUpdate {
  id: string;
  feedId: string;
  title: string;
  publishedAt: string | null;
  summary: string | null;
  sourceUrl: string | null;
}

/**
 * Official updates the asker may read, newest first — for "what changed
 * lately in GST?" questions. Same audience rule as retrieval: a client never
 * sees a staff-only (not yet published) update.
 */
export async function listRecentOfficialUpdates(
  ctx: AuthContext,
  input: { persona: 'client' | 'staff'; feedIds?: readonly string[]; sinceDays: number; limit: number },
): Promise<RecentOfficialUpdate[]> {
  assertAskRole(ctx);
  const persona = ctx.role === 'client' ? 'client' : input.persona;
  const since = new Date(Date.now() - input.sinceDays * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: askDocuments.id,
      feedId: askDocuments.feedId,
      title: askDocuments.title,
      publishedAt: askDocuments.publishedAt,
      summary: askDocuments.summary,
      sourceUrl: askDocuments.sourceUrl,
    })
    .from(askDocuments)
    .where(
      and(
        eq(askDocuments.status, 'ready'),
        inArray(askDocuments.audience, audiencesForPersona(persona)), approvedForReading(),
        sql`${askDocuments.feedId} is not null`,
        sql`${askDocuments.publishedAt} >= ${since}`,
        input.feedIds?.length ? inArray(askDocuments.feedId, [...input.feedIds]) : undefined,
      ),
    )
    .orderBy(desc(askDocuments.publishedAt))
    .limit(Math.max(1, Math.min(input.limit, 20)));
  return rows.map((r) => ({ ...r, feedId: r.feedId ?? '' }));
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
  /** Official updates: the date the government published it (YYYY-MM-DD). */
  publishedAt: string | null;
  rank: number;
}

/** Audiences a persona may read. Client persona never sees staff-only sources. */
function audiencesForPersona(persona: 'client' | 'staff'): AskDocumentAudience[] {
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
  const limit = Math.max(1, Math.min(input.limit, 20));
  const lexemes = sql`tsvector_to_array(to_tsvector('english', ${query}))`;
  const chunkLexemes = sql`tsvector_to_array(${askChunks.tsv})`;
  /**
   * `match` filters the chunks; `rank` orders them. Strict: every term
   * (websearch semantics). Loose: any term, ranked by how many of the
   * question's terms the chunk holds — compared as word lists, never re-parsed
   * as a query, so terms like "inc-20a" cannot break the syntax.
   */
  const run = (match: ReturnType<typeof sql>, rank: ReturnType<typeof sql<number>>, excludeIds: string[]) => {
    return db
      .select({
        id: askChunks.id,
        documentId: askChunks.documentId,
        documentTitle: askDocuments.title,
        sourceType: askDocuments.sourceType,
        sourceUrl: askDocuments.sourceUrl,
        text: askChunks.text,
        contextPrefix: askChunks.contextPrefix,
        publishedAt: askDocuments.publishedAt,
        rank,
      })
      .from(askChunks)
      .innerJoin(askDocuments, eq(askDocuments.id, askChunks.documentId))
      .where(
        and(
          eq(askDocuments.status, 'ready'),
          inArray(askDocuments.audience, audiencesForPersona(persona)), approvedForReading(),
          match,
          excludeIds.length ? sql`${askChunks.id} not in (${sql.join(excludeIds.map((id) => sql`${id}`), sql`, `)})` : undefined,
        ),
      )
      .orderBy(desc(rank))
      .limit(limit - excludeIds.length);
  };
  // 1. Every term: precise.
  const strictQuery = sql`websearch_to_tsquery('english', ${query})`;
  const strict = await run(sql`${askChunks.tsv} @@ ${strictQuery}`, sql<number>`ts_rank(${askChunks.tsv}, ${strictQuery})`, []);
  // 2. Top up with chunks sharing any term, most shared terms first, so a
  //    paraphrase ("who owns" vs a chunk saying "owner") still finds its chunk
  //    (2026-10-22: the strict query alone returned nothing for most real questions).
  let loose: typeof strict = [];
  if (strict.length < limit) {
    loose = await run(
      sql`${chunkLexemes} && ${lexemes}`,
      sql<number>`cardinality(array(select unnest(${chunkLexemes}) intersect select unnest(${lexemes})))::float / 100`,
      strict.map((r) => r.id),
    );
  }
  return [...strict, ...loose].map((r) => ({ ...r, rank: Number(r.rank) }));
}
