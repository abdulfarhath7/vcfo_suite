import { describe, expect, it } from 'vitest';
import { createAskMasker } from '@/lib/ask/mask';
import { maskingProvider } from '@/lib/ask/masked-provider';
import type { LlmProvider, LlmRequest, LlmResult } from '@/lib/ask/provider';

const usage = { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 };

function stub(reply: (req: LlmRequest) => LlmResult['content']): LlmProvider & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    name: 'stub',
    calls,
    async complete(req) {
      calls.push(req);
      return { model: 'm', content: reply(req), stopReason: 'end_turn', usage };
    },
  };
}

describe('maskingProvider', () => {
  it('masks system, messages, tool results and tool inputs, and restores the reply', async () => {
    const inner = stub(() => [
      { type: 'text', text: 'Write to [EMAIL_1].' },
      { type: 'tool_use', id: 't', name: 'x', input: { to: '[EMAIL_1]' } },
      { type: 'thinking', thinking: 'about [EMAIL_1]', signature: 'sig' },
    ] as unknown as LlmResult['content']);
    const provider = maskingProvider(inner, createAskMasker());
    const reply = await provider.complete({
      model: 'm',
      maxTokens: 10,
      system: [{ type: 'text', text: 'Support: help@firm.in' }],
      messages: [
        { role: 'user', content: 'I am asha@x.in, 9876543210' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'x', input: { q: 'asha@x.in' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'PAN ABCDE1234F' }] },
      ],
    });
    const sent = JSON.stringify(inner.calls[0]);
    for (const value of ['help@firm.in', 'asha@x.in', '9876543210', 'ABCDE1234F']) expect(sent).not.toContain(value);
    expect(reply.content[0]).toMatchObject({ type: 'text', text: 'Write to help@firm.in.' });
    expect(reply.content[1]).toMatchObject({ type: 'tool_use', input: { to: 'help@firm.in' } });
    // Thinking is left exactly as the model wrote it, so its signature still holds.
    expect(reply.content[2]).toMatchObject({ type: 'thinking', thinking: 'about [EMAIL_1]' });
  });

  it('restores a JSON reply value by value', async () => {
    const inner = stub(() => [{ type: 'text', text: '{"value":"[DIRECTOR_1]"}' }] as unknown as LlmResult['content']);
    const provider = maskingProvider(inner, createAskMasker({ people: [{ name: 'Asha "Ash" Rao', kind: 'DIRECTOR' }] }));
    const reply = await provider.complete({ model: 'm', maxTokens: 10, system: [], messages: [{ role: 'user', content: 'Asha "Ash" Rao' }] });
    const text = (reply.content[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual({ value: 'Asha "Ash" Rao' });
  });
});
