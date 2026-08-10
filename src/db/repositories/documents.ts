import 'server-only';

import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { documents, engagements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import {
  assertEngagementAccess,
  getEngagementById,
  managerOwnsEngagement,
} from '@/db/repositories/engagements';
import { listLeadMemberEngagementIds } from '@/db/repositories/engagement-leads-membership';

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
}

function mapRow(row: DocumentRow): DocumentDto {
  return {
    id: row.id,
    engagementId: row.engagementId,
    category: row.category,
    fileName: row.fileName,
    objectKey: row.objectKey,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    stepId: row.stepId,
    sharedWithClient: row.sharedWithClient,
    createdAt: row.createdAt.toISOString(),
  };
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
      .select()
      .from(documents)
      .where(where)
      .orderBy(desc(documents.createdAt));
    return rows.map(mapRow);
  }

  if (ctx.role === 'admin') {
    const rows = await db.select().from(documents).orderBy(desc(documents.createdAt));
    return rows.map(mapRow);
  }

  if (ctx.role === 'manager') {
    const rows = await db
      .select({ doc: documents })
      .from(documents)
      .innerJoin(engagements, eq(engagements.id, documents.engagementId))
      .where(managerOwnsEngagement(ctx.userId))
      .orderBy(desc(documents.createdAt));
    return rows.map((r) => mapRow(r.doc));
  }

  if (ctx.role === 'intern') {
    if (!ctx.internId) return [];
    const memberIds = await listLeadMemberEngagementIds(ctx.internId);
    const scope =
      memberIds.length > 0
        ? or(eq(engagements.internId, ctx.internId), inArray(engagements.id, memberIds))
        : eq(engagements.internId, ctx.internId);
    const rows = await db
      .select({ doc: documents })
      .from(documents)
      .innerJoin(engagements, eq(engagements.id, documents.engagementId))
      .where(scope)
      .orderBy(desc(documents.createdAt));
    return rows.map((r) => mapRow(r.doc));
  }

  const rows = await db
    .select({ doc: documents })
    .from(documents)
    .innerJoin(engagements, eq(engagements.id, documents.engagementId))
    .where(and(eq(documents.sharedWithClient, true), clientEngagementScope(ctx)))
    .orderBy(desc(documents.createdAt));
  return rows.map((r) => mapRow(r.doc));
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

  const [row] = await db
    .insert(documents)
    .values({
      engagementId: engagement.id,
      fileName: input.fileName.trim(),
      objectKey: input.objectKey.trim(),
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
