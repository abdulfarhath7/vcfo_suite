import 'server-only';

import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';
import { db } from '@/db/client';
import { sharepointFilesSeen } from '@/db/schema';
import { assertEngagementAccess } from './engagements';

/**
 * The SharePoint files a project's fetches have read. Every call checks that the caller can reach
 * the project first; a person without access reads and writes nothing.
 */

export interface SeenFile {
  itemId: string;
  cTag: string | null;
  sha256: string;
  readKey: string | null;
}

async function engagementOf(ctx: AuthContext, engagementId: string): Promise<string | null> {
  const access = await assertEngagementAccess(ctx, engagementId);
  return access.ok ? access.dbId : null;
}

/** Files of this project already read, by SharePoint item id. */
export async function listSeenSharepointFiles(ctx: AuthContext, engagementId: string): Promise<Map<string, SeenFile>> {
  const id = await engagementOf(ctx, engagementId);
  if (!id) return new Map();
  const rows = await db
    .select({ itemId: sharepointFilesSeen.itemId, cTag: sharepointFilesSeen.cTag, sha256: sharepointFilesSeen.sha256, readKey: sharepointFilesSeen.readKey })
    .from(sharepointFilesSeen)
    .where(eq(sharepointFilesSeen.engagementId, id));
  return new Map(rows.map((r) => [r.itemId, r]));
}

/** Records a file copied into a drop. A changed file replaces its old row and forgets the old read. */
export async function recordSharepointFileCopied(
  ctx: AuthContext,
  engagementId: string,
  file: { itemId: string; cTag: string | null; sha256: string; path: string; attachmentId: string },
): Promise<void> {
  const id = await engagementOf(ctx, engagementId);
  if (!id) return;
  await db
    .insert(sharepointFilesSeen)
    .values({ engagementId: id, ...file })
    .onConflictDoUpdate({
      target: [sharepointFilesSeen.engagementId, sharepointFilesSeen.itemId],
      set: {
        cTag: file.cTag,
        sha256: file.sha256,
        path: file.path,
        attachmentId: file.attachmentId,
        // The same bytes keep their read; new bytes must be read again.
        readKey: sql`CASE WHEN ${sharepointFilesSeen.sha256} = ${file.sha256} THEN ${sharepointFilesSeen.readKey} ELSE NULL END`,
        seenAt: new Date(),
      },
    });
}

/** The stored read of the same bytes on this project, if any, for the file copied as `attachmentId`. */
export async function findCachedSharepointRead(ctx: AuthContext, engagementId: string, attachmentId: string): Promise<string | null> {
  const id = await engagementOf(ctx, engagementId);
  if (!id) return null;
  const [mine] = await db
    .select({ sha256: sharepointFilesSeen.sha256 })
    .from(sharepointFilesSeen)
    .where(and(eq(sharepointFilesSeen.engagementId, id), eq(sharepointFilesSeen.attachmentId, attachmentId)))
    .limit(1);
  if (!mine) return null;
  const [read] = await db
    .select({ readKey: sharepointFilesSeen.readKey })
    .from(sharepointFilesSeen)
    .where(and(eq(sharepointFilesSeen.engagementId, id), eq(sharepointFilesSeen.sha256, mine.sha256), isNotNull(sharepointFilesSeen.readKey)))
    .limit(1);
  return read?.readKey ?? null;
}

/** Marks the file copied as `attachmentId` as read, with where its read is stored. */
export async function markSharepointFileRead(ctx: AuthContext, engagementId: string, attachmentId: string, readKey: string): Promise<void> {
  const id = await engagementOf(ctx, engagementId);
  if (!id) return;
  await db
    .update(sharepointFilesSeen)
    .set({ readKey })
    .where(and(eq(sharepointFilesSeen.engagementId, id), eq(sharepointFilesSeen.attachmentId, attachmentId)));
}
