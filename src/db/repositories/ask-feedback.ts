import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { askAnswerFeedback, askConversations, askMessages } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';

/**
 * ASK VCFO ANSWER FEEDBACK (👍/👎).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Written only for `ctx.userId`. A `messageId` is accepted only when that
 * message belongs to one of the caller's own conversations; otherwise it is
 * dropped (the vote is still kept with the question/answer text).
 */
export async function recordAnswerFeedback(
  ctx: AuthContext,
  input: { vote: 'up' | 'down'; messageId?: string | null; question?: string; answer?: string },
): Promise<{ id: string }> {
  let messageId: string | null = null;
  if (input.messageId && /^[0-9a-f-]{36}$/i.test(input.messageId)) {
    const [own] = await db
      .select({ id: askMessages.id })
      .from(askMessages)
      .innerJoin(askConversations, eq(askConversations.id, askMessages.conversationId))
      .where(and(eq(askMessages.id, input.messageId), eq(askConversations.profileId, ctx.userId)))
      .limit(1);
    messageId = own?.id ?? null;
  }
  const [row] = await db
    .insert(askAnswerFeedback)
    .values({
      profileId: ctx.userId,
      messageId,
      question: (input.question ?? '').slice(0, 2000),
      answer: (input.answer ?? '').slice(0, 4000),
      vote: input.vote,
    })
    .returning({ id: askAnswerFeedback.id });
  return { id: row!.id };
}
