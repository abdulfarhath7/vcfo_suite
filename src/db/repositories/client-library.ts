import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientLibraryItems } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { answerEnvelopeSchema, type AnswerEnvelope } from '@/data/ask/schema';
import { AskForbiddenError, assertAskRole } from '@/lib/ask/access';

/**
 * CLIENT LIBRARY — saved explanations.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Private to the saving profile in v1 (`shared_with_team` exists, unused).
 * Only a `client` may save; super admin previewing a client is read-only and,
 * because items are private, simply sees their own (empty) library. The
 * engagement on a new item must pass `assertEngagementAccess`.
 */

export type ClientLibraryRow = typeof clientLibraryItems.$inferSelect;

export interface SaveLibraryItemInput {
  engagementId: string;
  title: string;
  category: string;
  answer: AnswerEnvelope;
  topicSlug?: string | null;
  topicVersion?: number | null;
  messageId?: string | null;
}

export async function listLibraryItems(ctx: AuthContext): Promise<ClientLibraryRow[]> {
  assertAskRole(ctx);
  return db
    .select()
    .from(clientLibraryItems)
    .where(eq(clientLibraryItems.profileId, ctx.userId))
    .orderBy(desc(clientLibraryItems.createdAt));
}

export async function getLibraryItem(ctx: AuthContext, id: string): Promise<ClientLibraryRow | null> {
  assertAskRole(ctx);
  const [row] = await db
    .select()
    .from(clientLibraryItems)
    .where(and(eq(clientLibraryItems.id, id), eq(clientLibraryItems.profileId, ctx.userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Save or, for a topic already saved by this profile on this engagement,
 * refresh the existing item (one card per topic).
 */
export async function saveLibraryItem(
  ctx: AuthContext,
  input: SaveLibraryItemInput,
): Promise<ClientLibraryRow | null> {
  if (ctx.role !== 'client') throw new AskForbiddenError('Only clients save to the library');
  const answer = answerEnvelopeSchema.parse(input.answer);
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) return null;

  const values = {
    profileId: ctx.userId,
    engagementId: access.dbId,
    topicSlug: input.topicSlug ?? null,
    messageId: input.messageId ?? null,
    title: input.title.trim().slice(0, 160) || 'Saved explanation',
    category: input.category,
    snapshot: answer,
    sourceVersion: input.topicSlug ? (input.topicVersion ?? null) : null,
  };

  if (values.topicSlug) {
    const [existing] = await db
      .select()
      .from(clientLibraryItems)
      .where(
        and(
          eq(clientLibraryItems.profileId, ctx.userId),
          eq(clientLibraryItems.engagementId, access.dbId),
          eq(clientLibraryItems.topicSlug, values.topicSlug),
        ),
      )
      .limit(1);
    if (existing) {
      const [updated] = await db
        .update(clientLibraryItems)
        .set({
          title: values.title,
          category: values.category,
          snapshot: values.snapshot,
          sourceVersion: values.sourceVersion,
          createdAt: new Date(),
        })
        .where(and(eq(clientLibraryItems.id, existing.id), eq(clientLibraryItems.profileId, ctx.userId)))
        .returning();
      return updated ?? null;
    }
  }

  const [row] = await db.insert(clientLibraryItems).values(values).returning();
  return row ?? null;
}

export async function deleteLibraryItem(ctx: AuthContext, id: string): Promise<boolean> {
  if (ctx.role !== 'client') throw new AskForbiddenError('Only clients change the library');
  const rows = await db
    .delete(clientLibraryItems)
    .where(and(eq(clientLibraryItems.id, id), eq(clientLibraryItems.profileId, ctx.userId)))
    .returning({ id: clientLibraryItems.id });
  return rows.length > 0;
}
