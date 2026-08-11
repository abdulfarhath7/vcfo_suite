import 'server-only';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { documentRequests } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { DocRequest } from '@/data/engagements';
import {
  assertEngagementAccess,
  listEngagements,
} from '@/db/repositories/engagements';
import { LEGACY_ENGAGEMENT_IDS } from '@/lib/legacy-engagement-ids';

/**
 * DOCUMENT REQUESTS REPOSITORY — replaces vcfo.requests localStorage.
 *
 * Access: admin all; manager via owned engagements; intern/client via scoped engagements.
 */

type Row = typeof documentRequests.$inferSelect;
type AppStatus = DocRequest['status'];

function dbStatusToApp(status: string): AppStatus {
  if (status === 'fulfilled') return 'uploaded';
  if (status === 'cancelled') return 'rejected';
  if (status === 'uploaded' || status === 'approved' || status === 'rejected' || status === 'pending') {
    return status;
  }
  return 'pending';
}

function appStatusToDb(status: AppStatus): string {
  if (status === 'uploaded') return 'fulfilled';
  if (status === 'rejected') return 'cancelled';
  return status; // pending | approved (approved stored as-is; column is free text)
}

function appEngagementId(dbId: string): string {
  return LEGACY_ENGAGEMENT_IDS[dbId] ?? dbId;
}

export function toAppDocRequest(row: Row): DocRequest {
  return {
    id: row.id,
    engagementId: appEngagementId(row.engagementId),
    taskId: '',
    label: row.title,
    status: dbStatusToApp(row.status),
    requestedBy: row.requestedBy ?? '',
    message: row.detail ?? undefined,
  };
}

async function scopedEngagementIds(ctx: AuthContext): Promise<string[] | 'all'> {
  if (ctx.role === 'admin') return 'all';
  const rows = await listEngagements(ctx);
  return rows.map((r) => r.id);
}

export async function listDocumentRequests(ctx: AuthContext): Promise<DocRequest[]> {
  const scope = await scopedEngagementIds(ctx);
  if (scope !== 'all' && scope.length === 0) return [];

  const rows =
    scope === 'all'
      ? await db.select().from(documentRequests).orderBy(desc(documentRequests.createdAt))
      : await db
          .select()
          .from(documentRequests)
          .where(inArray(documentRequests.engagementId, scope))
          .orderBy(desc(documentRequests.createdAt));

  return rows.map(toAppDocRequest);
}

export async function getDocumentRequestById(
  ctx: AuthContext,
  id: string,
): Promise<DocRequest | null> {
  const [row] = await db
    .select()
    .from(documentRequests)
    .where(eq(documentRequests.id, id))
    .limit(1);
  if (!row) return null;
  const access = await assertEngagementAccess(ctx, row.engagementId);
  if (!access.ok) return null;
  return toAppDocRequest(row);
}

export interface CreateDocumentRequestInput {
  engagementId: string;
  taskId?: string;
  label: string;
  message?: string;
  dueAt?: string;
}

export async function createDocumentRequest(
  ctx: AuthContext,
  input: CreateDocumentRequestInput,
): Promise<DocRequest> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not create document requests');
  }
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) throw new Error('Engagement not found or not permitted');

  const [row] = await db
    .insert(documentRequests)
    .values({
      engagementId: access.dbId,
      requestedBy: ctx.userId,
      title: input.label,
      detail: input.message ?? null,
      status: 'pending',
    })
    .returning();

  const mapped = toAppDocRequest(row);
  return { ...mapped, taskId: input.taskId ?? '', dueAt: input.dueAt };
}

export async function updateDocumentRequest(
  ctx: AuthContext,
  id: string,
  patch: Partial<Pick<DocRequest, 'status' | 'label' | 'message' | 'fileName' | 'uploadedAt'>>,
): Promise<DocRequest | null> {
  const existing = await getDocumentRequestById(ctx, id);
  if (!existing) return null;

  // Clients may mark uploaded; staff may approve/reject/cancel.
  if (ctx.role === 'client' && patch.status && patch.status !== 'uploaded') {
    throw new Error('Clients may only mark requests as uploaded');
  }

  const detailParts: string[] = [];
  if (patch.message !== undefined) detailParts.push(patch.message);
  else if (existing.message) detailParts.push(existing.message);
  if (patch.fileName) detailParts.push(`file:${patch.fileName}`);
  if (patch.uploadedAt) detailParts.push(`uploadedAt:${patch.uploadedAt}`);

  const [row] = await db
    .update(documentRequests)
    .set({
      ...(patch.label !== undefined ? { title: patch.label } : {}),
      ...(patch.status !== undefined ? { status: appStatusToDb(patch.status) } : {}),
      ...(patch.message !== undefined || patch.fileName !== undefined || patch.uploadedAt !== undefined
        ? { detail: detailParts.filter(Boolean).join('\n') || null }
        : {}),
    })
    .where(eq(documentRequests.id, id))
    .returning();

  if (!row) return null;
  const mapped = toAppDocRequest(row);
  return {
    ...mapped,
    fileName: patch.fileName ?? existing.fileName,
    uploadedAt: patch.uploadedAt ?? existing.uploadedAt,
    dueAt: existing.dueAt,
    taskId: existing.taskId,
  };
}
