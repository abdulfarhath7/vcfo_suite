import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';
import type { AnswerEnvelope } from '@/data/ask/schema';

/**
 * Topic reads (suggested questions) are saved into the shared conversation
 * (owner item F4). The conversation rule matches the chat pipeline: reuse only
 * the caller's own chat with the same shell and engagement.
 */

const getAskConversation = vi.fn();
const createAskConversation = vi.fn();
const appendAskMessage = vi.fn();

vi.mock('@/db/repositories/ask-conversations', () => ({
  getAskConversation: (...a: unknown[]) => getAskConversation(...a),
  createAskConversation: (...a: unknown[]) => createAskConversation(...a),
}));
vi.mock('@/db/repositories/ask-messages', () => ({
  appendAskMessage: (...a: unknown[]) => appendAskMessage(...a),
}));

const { recordTopicExchange } = await import('@/lib/ask/topic-record');

const clientA: AuthContext = { userId: 'user-a', email: 'a@x.test', name: 'A', role: 'client' };
const ENG = '11111111-1111-1111-1111-111111111111';
const answer: AnswerEnvelope = { line: 'GST is a tax.', citations: [], actions: ['save'], origin: 'reviewed', depth: 'normal', topicSlug: 'gst' };

beforeEach(() => {
  vi.clearAllMocks();
  createAskConversation.mockResolvedValue({ id: 'new-conv' });
  appendAskMessage.mockImplementation((_c, _id, input: { sender: string }) => Promise.resolve({ id: `msg-${input.sender}` }));
});

describe('recordTopicExchange', () => {
  it('appends the question and the stored answer to the caller’s matching chat', async () => {
    getAskConversation.mockResolvedValue({ id: 'conv-1', shell: 'client', engagementId: ENG });
    const out = await recordTopicExchange(clientA, { conversationId: 'conv-1', shell: 'client', engagementId: ENG, question: '  What is GST? ', answer });
    expect(out).toEqual({ conversationId: 'conv-1', messageId: 'msg-assistant' });
    expect(createAskConversation).not.toHaveBeenCalled();
    expect(appendAskMessage).toHaveBeenNthCalledWith(1, clientA, 'conv-1', { sender: 'user', text: 'What is GST?' });
    expect(appendAskMessage).toHaveBeenNthCalledWith(2, clientA, 'conv-1', {
      sender: 'assistant',
      text: answer.line,
      answer,
      origin: 'reviewed',
    });
  });

  it('starts a new chat when the id is not the caller’s', async () => {
    getAskConversation.mockResolvedValue(null);
    const out = await recordTopicExchange(clientA, { conversationId: 'conv-of-b', shell: 'client', engagementId: ENG, question: 'Q', answer });
    expect(out?.conversationId).toBe('new-conv');
    expect(createAskConversation).toHaveBeenCalledWith(clientA, { shell: 'client', engagementId: ENG });
    expect(appendAskMessage.mock.calls.every((c) => c[1] === 'new-conv')).toBe(true);
  });

  it('starts a new chat when the engagement differs', async () => {
    getAskConversation.mockResolvedValue({ id: 'conv-1', shell: 'client', engagementId: 'other' });
    const out = await recordTopicExchange(clientA, { conversationId: 'conv-1', shell: 'client', engagementId: ENG, question: 'Q', answer });
    expect(out?.conversationId).toBe('new-conv');
  });

  it('saves nothing when the engagement is refused', async () => {
    createAskConversation.mockResolvedValue(null);
    await expect(recordTopicExchange(clientA, { shell: 'client', engagementId: ENG, question: 'Q', answer })).resolves.toBeNull();
    expect(appendAskMessage).not.toHaveBeenCalled();
  });

  it('records no model, so the rate limit never counts it', async () => {
    getAskConversation.mockResolvedValue({ id: 'conv-1', shell: 'client', engagementId: ENG });
    await recordTopicExchange(clientA, { conversationId: 'conv-1', shell: 'client', engagementId: ENG, question: 'Q', answer });
    for (const call of appendAskMessage.mock.calls) expect((call[2] as { model?: unknown }).model).toBeUndefined();
  });
});
