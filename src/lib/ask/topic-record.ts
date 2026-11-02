import 'server-only';

import type { AuthContext } from '@/auth/guards';
import type { AnswerEnvelope, AskShell } from '@/data/ask/schema';
import { createAskConversation, getAskConversation } from '@/db/repositories/ask-conversations';
import { appendAskMessage } from '@/db/repositories/ask-messages';

/**
 * Saves a topic read (a suggested question, a glossary term, "Simpler, please")
 * into the shared Ask conversation, so the full page shows it (owner item F4).
 * The answer is the one the topic route already built; this only stores it.
 * The conversation rule is the chat pipeline's: the given id is reused only when
 * the caller owns it and it has the same shell and engagement, or a new one starts.
 * No model is recorded, so the model-answer rate limit does not count it.
 */
export interface RecordTopicExchangeInput {
  conversationId?: string | null;
  shell: AskShell;
  /** The engagement DB id (client shell), or null. */
  engagementId: string | null;
  question: string;
  answer: AnswerEnvelope;
}

export async function recordTopicExchange(
  ctx: AuthContext,
  input: RecordTopicExchangeInput,
): Promise<{ conversationId: string; messageId: string } | null> {
  const question = input.question.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!question) return null;

  let conversationId: string | null = null;
  if (input.conversationId) {
    const existing = await getAskConversation(ctx, input.conversationId);
    if (existing && existing.shell === input.shell && (existing.engagementId ?? null) === input.engagementId) {
      conversationId = existing.id;
    }
  }
  if (!conversationId) {
    const created = await createAskConversation(ctx, { shell: input.shell, engagementId: input.engagementId });
    if (!created) return null;
    conversationId = created.id;
  }

  await appendAskMessage(ctx, conversationId, { sender: 'user', text: question });
  const row = await appendAskMessage(ctx, conversationId, {
    sender: 'assistant',
    text: input.answer.line,
    answer: input.answer,
    origin: input.answer.origin,
  });
  if (!row) return null;
  return { conversationId, messageId: row.id };
}
