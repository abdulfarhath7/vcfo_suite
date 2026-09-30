import 'server-only';

import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { askConversations, askMessages } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import type { AskShell } from '@/data/ask/schema';
import { AskForbiddenError, assertAskRole, shellAllowedForRole } from '@/lib/ask/access';

/**
 * ASK VCFO CONVERSATIONS.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * A conversation belongs to exactly one profile. Every read and write checks
 * `profile_id = ctx.userId`; there is no admin override, so even a firm admin
 * cannot read a client's Ask VCFO history. Managers and Project Leads are
 * rejected before any query runs.
 *
 * A client-shell conversation is pinned to one engagement the caller can
 * access (client: their own; super admin: the engagement being previewed).
 */

export type AskConversationRow = typeof askConversations.$inferSelect;
export type AskMessageRow = typeof askMessages.$inferSelect;

export interface CreateAskConversationInput {
  shell: AskShell;
  /** Required for the client shell. */
  engagementId?: string | null;
}

export async function createAskConversation(
  ctx: AuthContext,
  input: CreateAskConversationInput,
): Promise<AskConversationRow | null> {
  assertAskRole(ctx);
  if (!shellAllowedForRole(ctx.role, input.shell)) throw new AskForbiddenError('Shell not allowed');

  let engagementDbId: string | null = null;
  if (input.shell === 'client') {
    if (!input.engagementId) throw new Error('A client conversation needs an engagement');
    const access = await assertEngagementAccess(ctx, input.engagementId);
    if (!access.ok) return null;
    engagementDbId = access.dbId;
  }

  const [row] = await db
    .insert(askConversations)
    .values({
      profileId: ctx.userId,
      role: ctx.role,
      shell: input.shell,
      engagementId: engagementDbId,
    })
    .returning();
  return row ?? null;
}

/** Owner-only read. Returns null for someone else's conversation. */
export async function getAskConversation(
  ctx: AuthContext,
  conversationId: string,
): Promise<AskConversationRow | null> {
  assertAskRole(ctx);
  const [row] = await db
    .select()
    .from(askConversations)
    .where(and(eq(askConversations.id, conversationId), eq(askConversations.profileId, ctx.userId)))
    .limit(1);
  return row ?? null;
}

/** Conversation + messages oldest first (resume, U3). */
export async function getAskConversationWithMessages(
  ctx: AuthContext,
  conversationId: string,
): Promise<{ conversation: AskConversationRow; messages: AskMessageRow[] } | null> {
  const conversation = await getAskConversation(ctx, conversationId);
  if (!conversation) return null;
  const messages = await db
    .select()
    .from(askMessages)
    .where(eq(askMessages.conversationId, conversation.id))
    .orderBy(asc(askMessages.createdAt));
  return { conversation, messages };
}

/** The caller's most recent conversation for a shell (+ engagement). */
export async function getLatestAskConversation(
  ctx: AuthContext,
  shell: AskShell,
  engagementDbId: string | null,
): Promise<AskConversationRow | null> {
  assertAskRole(ctx);
  const conditions = [eq(askConversations.profileId, ctx.userId), eq(askConversations.shell, shell)];
  if (engagementDbId) conditions.push(eq(askConversations.engagementId, engagementDbId));
  const [row] = await db
    .select()
    .from(askConversations)
    .where(and(...conditions))
    .orderBy(desc(askConversations.lastMessageAt))
    .limit(1);
  return row ?? null;
}
