import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementBoardResolutions } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { BoardResolutionDoc } from '@/lib/board-resolution';
import { parseBoardResolutionRpcPayload } from '@/lib/board-resolution';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { getEngagementById } from '@/db/repositories/engagements';

/**
 * BOARD RESOLUTION REPOSITORY.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Scoped via getEngagementById (four-role):
 *   admin: all engagements
 *   manager: owned engagements (manager_id / legacy admin_id)
 *   intern: via assigned engagement; updates only while status = draft
 *           (repairFinalizedStorage is the exception for corrupt-file repair)
 *   client: read via own engagement; may set signed_* after finalize
 */

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function mapRow(row: typeof engagementBoardResolutions.$inferSelect): BoardResolutionDoc {
  return (
    parseBoardResolutionRpcPayload({
      content: row.content,
      status: row.status,
      storagePath: row.storagePath,
      storage_path: row.storagePath,
      draftedAt: toIso(row.draftedAt),
      finalizedAt: toIso(row.finalizedAt),
      finalizedBy: row.finalizedBy,
      updatedAt: toIso(row.updatedAt),
      templateFingerprint: row.templateFingerprint,
      template_fingerprint: row.templateFingerprint,
      signedStoragePath: row.signedStoragePath,
      signed_storage_path: row.signedStoragePath,
      signedUploadedAt: toIso(row.signedUploadedAt),
      signed_uploaded_at: toIso(row.signedUploadedAt),
      signedUploadedBy: row.signedUploadedBy,
      signed_uploaded_by: row.signedUploadedBy,
    }) ?? {
      content: row.content,
      status: row.status === 'finalized' ? 'finalized' : 'draft',
      storagePath: row.storagePath,
    }
  );
}

async function requireEngagement(ctx: AuthContext, appOrDbId: string) {
  const row = await getEngagementById(ctx, engagementDbId(appOrDbId));
  if (!row) throw new Error('Engagement not found or not permitted');
  return row;
}

export async function getBoardResolutionByEngagementId(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<BoardResolutionDoc | null> {
  const engagement = await getEngagementById(ctx, engagementDbId(appOrDbId));
  if (!engagement) return null;

  const [row] = await db
    .select()
    .from(engagementBoardResolutions)
    .where(eq(engagementBoardResolutions.engagementId, engagement.id))
    .limit(1);

  return row ? mapRow(row) : null;
}

export async function saveBoardResolutionDraft(
  ctx: AuthContext,
  appOrDbId: string,
  content: string,
  storagePath?: string | null,
  templateFingerprint?: string | null,
): Promise<BoardResolutionDoc> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not edit board resolution drafts');
  }

  const engagement = await requireEngagement(ctx, appOrDbId);
  const existing = await getBoardResolutionByEngagementId(ctx, engagement.id);
  if (existing?.status === 'finalized') {
    throw new Error('Board resolution is finalized');
  }

  const now = new Date();
  const values = {
    engagementId: engagement.id,
    content,
    status: 'draft' as const,
    draftedAt: now,
    storagePath: storagePath?.trim() || null,
    templateFingerprint: templateFingerprint?.trim() || null,
    updatedAt: now,
  };

  const [row] = await db
    .insert(engagementBoardResolutions)
    .values(values)
    .onConflictDoUpdate({
      target: engagementBoardResolutions.engagementId,
      set: {
        content: values.content,
        status: 'draft',
        draftedAt: values.draftedAt,
        storagePath: values.storagePath,
        templateFingerprint: values.templateFingerprint,
        updatedAt: values.updatedAt,
      },
    })
    .returning();

  return mapRow(row);
}

/** Rebuild storage for a finalized doc without changing status (corrupt-file repair). */
export async function repairBoardResolutionStorage(
  ctx: AuthContext,
  appOrDbId: string,
  content: string,
  storagePath: string,
  templateFingerprint?: string | null,
): Promise<BoardResolutionDoc> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not repair board resolution storage');
  }

  const engagement = await requireEngagement(ctx, appOrDbId);
  const path = storagePath.trim();
  if (!path) throw new Error('storage_path required for repair');

  const [row] = await db
    .update(engagementBoardResolutions)
    .set({
      content,
      storagePath: path,
      templateFingerprint: templateFingerprint?.trim() || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(engagementBoardResolutions.engagementId, engagement.id),
        eq(engagementBoardResolutions.status, 'finalized'),
      ),
    )
    .returning();

  if (!row) throw new Error('Finalized board resolution not found');
  return mapRow(row);
}

/** Finalize draft → client-visible board resolution. */
export async function finalizeBoardResolution(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<BoardResolutionDoc> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not finalize board resolutions');
  }

  const engagement = await requireEngagement(ctx, appOrDbId);
  const existing = await getBoardResolutionByEngagementId(ctx, engagement.id);
  if (!existing) {
    throw new Error('Board resolution draft not found — generate it first');
  }
  if (existing.status === 'finalized') {
    return existing;
  }
  if (!existing.storagePath?.trim() && !existing.content?.trim()) {
    throw new Error('Board resolution has no document content to finalize');
  }

  const now = new Date();
  const [row] = await db
    .update(engagementBoardResolutions)
    .set({
      status: 'finalized',
      finalizedAt: now,
      finalizedBy: ctx.userId,
      updatedAt: now,
    })
    .where(eq(engagementBoardResolutions.engagementId, engagement.id))
    .returning();

  if (!row) throw new Error('Board resolution not found');
  return mapRow(row);
}

export async function setSignedBoardResolution(
  ctx: AuthContext,
  appOrDbId: string,
  signedStoragePath: string,
): Promise<BoardResolutionDoc> {
  const engagement = await requireEngagement(ctx, appOrDbId);
  const path = signedStoragePath.trim();
  if (!path) throw new Error('signed_storage_path required');

  const existing = await getBoardResolutionByEngagementId(ctx, engagement.id);
  if (!existing || existing.status !== 'finalized') {
    throw new Error('Board resolution is not finalized');
  }

  const now = new Date();
  const [row] = await db
    .update(engagementBoardResolutions)
    .set({
      signedStoragePath: path,
      signedUploadedAt: now,
      signedUploadedBy: ctx.userId,
      updatedAt: now,
    })
    .where(eq(engagementBoardResolutions.engagementId, engagement.id))
    .returning();

  if (!row) throw new Error('Board resolution not found');
  return mapRow(row);
}
