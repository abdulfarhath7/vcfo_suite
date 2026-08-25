import 'server-only';

import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { documents, engagements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { appEngagementId, engagementDbId } from '@/lib/legacy-engagement-ids';
import {
  assertEngagementAccess,
  getEngagementById,
  managerOwnsEngagement,
} from '@/db/repositories/engagements';
import { listLeadMemberEngagementIds } from '@/db/repositories/engagement-leads-membership';
import { listManagerMemberEngagementIds } from '@/db/repositories/engagement-managers-membership';

/**
 * DOCUMENTS REPOSITORY.
 *
 * Forward-looking index for per-engagement files (certificates, filings,
 * milestone attachments). Milestone upload/download still works off object
 * paths in checklist_state — a row here is optional metadata.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * No original RLS (new table). Product default:
 *   admin: all
 *   manager: via owned engagements (manager_id / legacy admin_id)
 *   intern: via assigned engagement
 *   client: via own engagement; list only shared_with_client = true
 */

export type DocumentRow = typeof documents.$inferSelect;

export interface DocumentDto {
  id: string;
  engagementId: string;
  category: string | null;
  fileName: string;
  objectKey: string;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  stepId: string | null;
  sharedWithClient: boolean;
  createdAt: string;
  companyName?: string;
  slug?: string | null;
  stage?: string | null;
}

function mapRow(
  row: DocumentRow,
  extra?: { companyName?: string; slug?: string | null; stage?: string | null },
): DocumentDto {
  return {
    id: row.id,
    engagementId: appEngagementId(row.engagementId),
    category: row.category,
    fileName: row.fileName,
    objectKey: row.objectKey,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    stepId: row.stepId,
    sharedWithClient: row.sharedWithClient,
    createdAt: row.createdAt.toISOString(),
    companyName: extra?.companyName,
    slug: extra?.slug,
    stage: extra?.stage,
  };
}

const joinedSelect = {
  doc: documents,
  companyName: engagements.companyName,
  slug: engagements.slug,
  stage: engagements.stage,
};

function mapJoined(row: {
  doc: DocumentRow;
  companyName: string;
  slug: string | null;
  stage: string;
}): DocumentDto {
  return mapRow(row.doc, {
    companyName: row.companyName,
    slug: row.slug,
    stage: row.stage,
  });
}

function clientEngagementScope(ctx: AuthContext) {
  if (ctx.clientId) {
    return or(
      eq(engagements.clientUserId, ctx.userId),
      eq(engagements.clientId, ctx.clientId),
    );
  }
  return eq(engagements.clientUserId, ctx.userId);
}

export async function listDocuments(
  ctx: AuthContext,
  engagementId?: string,
): Promise<DocumentDto[]> {
  if (engagementId) {
    const access = await assertEngagementAccess(ctx, engagementId);
    if (!access.ok) return [];

    const where =
      ctx.role === 'client'
        ? and(
            eq(documents.engagementId, access.dbId),
            eq(documents.sharedWithClient, true),
          )
        : eq(documents.engagementId, access.dbId);

    const rows = await db
      .select(joinedSelect)
      .from(documents)
      .innerJoin(engagements, eq(engagements.id, documents.engagementId))
      .where(where)
      .orderBy(desc(documents.createdAt));
    return rows.map(mapJoined);
  }

  if (isFirmWideAdmin(ctx.role)) {
    const rows = await db
      .select(joinedSelect)
      .from(documents)
      .innerJoin(engagements, eq(engagements.id, documents.engagementId))
      .orderBy(desc(documents.createdAt));
    return rows.map(mapJoined);
  }

  if (ctx.role === 'manager') {
    const memberIds = await listManagerMemberEngagementIds(ctx.userId);
    const conds = [managerOwnsEngagement(ctx.userId)];
    if (memberIds.length > 0) conds.push(inArray(engagements.id, memberIds));
    const roleScope = conds.length === 1 ? conds[0] : or(...conds);
    const rows = await db
      .select(joinedSelect)
      .from(documents)
      .innerJoin(engagements, eq(engagements.id, documents.engagementId))
      .where(roleScope)
      .orderBy(desc(documents.createdAt));
    return rows.map(mapJoined);
  }

  if (ctx.role === 'intern') {
    if (!ctx.internId) return [];
    const memberIds = await listLeadMemberEngagementIds(ctx.internId);
    const scope =
      memberIds.length > 0
        ? or(eq(engagements.internId, ctx.internId), inArray(engagements.id, memberIds))
        : eq(engagements.internId, ctx.internId);
    const rows = await db
      .select(joinedSelect)
      .from(documents)
      .innerJoin(engagements, eq(engagements.id, documents.engagementId))
      .where(scope)
      .orderBy(desc(documents.createdAt));
    return rows.map(mapJoined);
  }

  const rows = await db
    .select(joinedSelect)
    .from(documents)
    .innerJoin(engagements, eq(engagements.id, documents.engagementId))
    .where(and(eq(documents.sharedWithClient, true), clientEngagementScope(ctx)))
    .orderBy(desc(documents.createdAt));
  return rows.map(mapJoined);
}

/** Single index row, scoped by engagement access (clients: shared rows only). */
export async function getDocumentById(
  ctx: AuthContext,
  id: string,
): Promise<DocumentDto | null> {
  const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!row) return null;

  const access = await assertEngagementAccess(ctx, row.engagementId);
  if (!access.ok) return null;
  if (ctx.role === 'client' && !row.sharedWithClient) return null;

  return mapRow(row);
}

export interface CreateDocumentInput {
  engagementId: string;
  fileName: string;
  objectKey: string;
  category?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  stepId?: string | null;
  sharedWithClient?: boolean;
}

export async function createDocument(
  ctx: AuthContext,
  input: CreateDocumentInput,
): Promise<DocumentDto> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not create document index rows');
  }

  const engagement = await getEngagementById(ctx, engagementDbId(input.engagementId));
  if (!engagement) throw new Error('Engagement not found or not permitted');

  const objectKey = input.objectKey.trim();
  const [existing] = await db
    .select()
    .from(documents)
    .where(eq(documents.objectKey, objectKey))
    .limit(1);
  if (existing) {
    const access = await assertEngagementAccess(ctx, existing.engagementId);
    if (!access.ok) throw new Error('Engagement not found or not permitted');
    return mapRow(existing);
  }

  const [row] = await db
    .insert(documents)
    .values({
      engagementId: engagement.id,
      fileName: input.fileName.trim(),
      objectKey,
      category: input.category?.trim() || null,
      contentType: input.contentType?.trim() || null,
      sizeBytes: input.sizeBytes ?? null,
      stepId: input.stepId?.trim() || null,
      sharedWithClient: input.sharedWithClient ?? false,
      uploadedBy: ctx.userId,
    })
    .returning();

  return mapRow(row);
}

/**
 * Delete a document row. Admin or owning manager. Returns the object key so
 * the caller can remove the S3 object, or null if nothing was deleted.
 */
export async function deleteDocument(
  ctx: AuthContext,
  id: string,
): Promise<string | null> {
  if (ctx.role !== 'admin' && ctx.role !== 'manager') {
    throw new Error('Only admins or managers may delete documents');
  }

  const [existing] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (!existing) return null;

  const access = await assertEngagementAccess(ctx, existing.engagementId);
  if (!access.ok) return null;

  const [row] = await db
    .delete(documents)
    .where(eq(documents.id, id))
    .returning({ objectKey: documents.objectKey });

  return row?.objectKey ?? null;
}
