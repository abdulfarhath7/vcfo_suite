import 'server-only';

import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { assistConversations, assistMessages } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import type { AssistShell } from '@/data/assist/schema';
import { AssistForbiddenError, assertAssistRole, shellAllowedForRole } from '@/lib/assist/access';

/**
 * ASSIST CONVERSATIONS.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * A conversation belongs to exactly one profile. Every read and write checks
 * `profile_id = ctx.userId`; there is no admin override, so even a firm admin
 * cannot read a client's Assist history. Managers and Project Leads are
 * rejected before any query runs.
 *
 * A client-shell conversation is pinned to one engagement the caller can
 * access (client: their own; super admin: the engagement being previewed).
 */

export type AssistConversationRow = typeof assistConversations.$inferSelect;
export type AssistMessageRow = typeof assistMessages.$inferSelect;

export interface CreateAssistConversationInput {
  shell: AssistShell;
  /** Required for the client shell. */
  engagementId?: string | null;
}

export async function createAssistConversation(
  ctx: AuthContext,
  input: CreateAssistConversationInput,
): Promise<AssistConversationRow | null> {
  assertAssistRole(ctx);
  if (!shellAllowedForRole(ctx.role, input.shell)) throw new AssistForbiddenError('Shell not allowed');

  let engagementDbId: string | null = null;
  if (input.shell === 'client') {
    if (!input.engagementId) throw new Error('A client conversation needs an engagement');
    const access = await assertEngagementAccess(ctx, input.engagementId);
    if (!access.ok) return null;
    engagementDbId = access.dbId;
  }

  const [row] = await db
    .insert(assistConversations)
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
export async function getAssistConversation(
  ctx: AuthContext,
  conversationId: string,
): Promise<AssistConversationRow | null> {
  assertAssistRole(ctx);
  const [row] = await db
    .select()
    .from(assistConversations)
    .where(and(eq(assistConversations.id, conversationId), eq(assistConversations.profileId, ctx.userId)))
    .limit(1);
  return row ?? null;
}

/** Conversation + messages oldest first (resume, U3). */
export async function getAssistConversationWithMessages(
  ctx: AuthContext,
  conversationId: string,
): Promise<{ conversation: AssistConversationRow; messages: AssistMessageRow[] } | null> {
  const conversation = await getAssistConversation(ctx, conversationId);
  if (!conversation) return null;
  const messages = await db
    .select()
    .from(assistMessages)
    .where(eq(assistMessages.conversationId, conversation.id))
    .orderBy(asc(assistMessages.createdAt));
  return { conversation, messages };
}

/** The caller's most recent conversation for a shell (+ engagement). */
export async function getLatestAssistConversation(
  ctx: AuthContext,
  shell: AssistShell,
  engagementDbId: string | null,
): Promise<AssistConversationRow | null> {
  assertAssistRole(ctx);
  const conditions = [eq(assistConversations.profileId, ctx.userId), eq(assistConversations.shell, shell)];
  if (engagementDbId) conditions.push(eq(assistConversations.engagementId, engagementDbId));
  const [row] = await db
    .select()
    .from(assistConversations)
    .where(and(...conditions))
    .orderBy(desc(assistConversations.lastMessageAt))
    .limit(1);
  return row ?? null;
}
