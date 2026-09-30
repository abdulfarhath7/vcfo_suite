import 'server-only';

import { and, count, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { assistConversations, assistMessages } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { AnswerEnvelope, AnswerOrigin } from '@/data/assist/schema';
import { getAssistConversation, type AssistMessageRow } from '@/db/repositories/assist-conversations';

/**
 * ASSIST MESSAGES — owner-only, always through the parent conversation's
 * ownership check. Usage columns feed cost tracking and the rate limit.
 */

export interface AppendAssistMessageInput {
  sender: 'user' | 'assistant';
  text: string;
  answer?: AnswerEnvelope | null;
  origin?: AnswerOrigin | null;
  guard?: unknown;
  retrievedChunkIds?: string[];
  /** Names + arguments only — callers must not pass tool results. */
  toolCalls?: Array<{ name: string; args: unknown }>;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadTokens?: number | null;
  latencyMs?: number | null;
}

export async function appendAssistMessage(
  ctx: AuthContext,
  conversationId: string,
  input: AppendAssistMessageInput,
): Promise<AssistMessageRow | null> {
  const conversation = await getAssistConversation(ctx, conversationId);
  if (!conversation) return null;

  const now = new Date();
  const [row] = await db
    .insert(assistMessages)
    .values({
      conversationId: conversation.id,
      sender: input.sender,
      text: input.text,
      answer: input.answer ?? null,
      origin: input.origin ?? null,
      guard: input.guard ?? null,
      retrievedChunkIds: input.retrievedChunkIds ?? [],
      toolCalls: input.toolCalls ?? [],
      model: input.model ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      cacheReadTokens: input.cacheReadTokens ?? null,
      latencyMs: input.latencyMs ?? null,
      createdAt: now,
    })
    .returning();
  await db
    .update(assistConversations)
    .set({ lastMessageAt: now })
    .where(eq(assistConversations.id, conversation.id));
  return row ?? null;
}

/** Owner-only single message (library save from a generated answer). */
export async function getAssistMessage(
  ctx: AuthContext,
  messageId: string,
): Promise<(AssistMessageRow & { engagementId: string | null }) | null> {
  const [row] = await db
    .select({ message: assistMessages, engagementId: assistConversations.engagementId })
    .from(assistMessages)
    .innerJoin(assistConversations, eq(assistConversations.id, assistMessages.conversationId))
    .where(and(eq(assistMessages.id, messageId), eq(assistConversations.profileId, ctx.userId)))
    .limit(1);
  return row ? { ...row.message, engagementId: row.engagementId } : null;
}

/**
 * Model-backed answers the caller received since `since`. Deterministic and
 * reviewed-topic answers never record a model, so they count as zero.
 */
export async function countModelAnswersSince(ctx: AuthContext, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(assistMessages)
    .innerJoin(assistConversations, eq(assistConversations.id, assistMessages.conversationId))
    .where(
      and(
        eq(assistConversations.profileId, ctx.userId),
        eq(assistMessages.sender, 'assistant'),
        isNotNull(assistMessages.model),
        inArray(assistMessages.origin, ['generated', 'refusal']),
        gte(assistMessages.createdAt, since),
      ),
    );
  return Number(row?.n ?? 0);
}
