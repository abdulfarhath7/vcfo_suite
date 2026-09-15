import 'server-only';

import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { documents, engagements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { normalizeChecklistItemSlice } from '@/lib/checklist-state-key';
import { checklistViewerForRole, isStepReleasedTo } from '@/lib/checklist-visibility';
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
 *
 * On top of the row scope, a file attached to a checklist step follows that
 * step's release (`checklist-visibility.ts`): the lead's uploads stay theirs
 * until they ask for approval, and the client's until the manager accepts.
 */

type DocumentRow = typeof documents.$inferSelect;

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
  /** Only the owning step's slice — never the whole `checklist_state` blob. */
  stepSlice: sql<unknown>`${engagements.checklistState} -> ${documents.stepId}`,
};

type JoinedRow = {
  doc: DocumentRow;
  companyName: string;
  slug: string | null;
  stage: string;
  stepSlice: unknown;
};

/** A step-attached file is readable once its step is released to this viewer. */
function stepReleasedForViewer(
  ctx: Pick<AuthContext, 'role'>,
  stepId: string | null,
  stepSlice: unknown,
): boolean {
  if (!stepId) return true;
  const viewer = checklistViewerForRole(ctx.role);
  if (viewer === 'lead') return true;
  return isStepReleasedTo(viewer, normalizeChecklistItemSlice(stepSlice, stepId));
}

function mapJoinedRows(ctx: Pick<AuthContext, 'role'>, rows: JoinedRow[]): DocumentDto[] {
  return rows
    .filter((row) => stepReleasedForViewer(ctx, row.doc.stepId, row.stepSlice))
    .map((row) =>
      mapRow(row.doc, {
        companyName: row.companyName,
        slug: row.slug,
        stage: row.stage,
      }),
    );
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
    return mapJoinedRows(ctx, rows);
  }

  if (isFirmWideAdmin(ctx.role)) {
    const rows = await db
      .select(joinedSelect)
      .from(documents)
      .innerJoin(engagements, eq(engagements.id, documents.engagementId))
      .orderBy(desc(documents.createdAt));
    return mapJoinedRows(ctx, rows);
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
    return mapJoinedRows(ctx, rows);
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
    return mapJoinedRows(ctx, rows);
  }

  const rows = await db
    .select(joinedSelect)
    .from(documents)
    .innerJoin(engagements, eq(engagements.id, documents.engagementId))
    .where(and(eq(documents.sharedWithClient, true), clientEngagementScope(ctx)))
    .orderBy(desc(documents.createdAt));
  return mapJoinedRows(ctx, rows);
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
  const state = access.row.checklistState as Record<string, unknown> | null;
  if (!stepReleasedForViewer(ctx, row.stepId, row.stepId ? state?.[row.stepId] : undefined)) {
    return null;
  }

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
