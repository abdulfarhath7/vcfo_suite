import { describe, expect, it } from 'vitest';
import { generateAnswer, type GenerateInput } from '@/lib/ask/generate';
import type { LlmResult } from '@/lib/ask/provider';
import type { AnswerEnvelope } from '@/data/ask/schema';

/**
 * The answer budget: a finished answer is kept even when its reply crosses the budget, and cache
 * writes count toward the budget like the rest of the input.
 */

const usage = (inputTokens: number, cacheWriteTokens = 0) => ({ inputTokens, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens });
const reply = (content: unknown[], tokens: ReturnType<typeof usage>, stopReason = 'tool_use'): LlmResult => ({ model: 'claude-sonnet-5-5', content: content as LlmResult['content'], stopReason, usage: tokens });
const render = { type: 'tool_use', id: 'r1', name: 'render_answer', input: { line: 'Due on 30 November.' } };
const lookUp = { type: 'tool_use', id: 't1', name: 'lookUp', input: {} };

function inputWith(script: LlmResult[], maxTotalTokens: number): GenerateInput {
  return {
    provider: { name: 'scripted', complete: async () => script.shift() ?? Promise.reject(new Error('unexpected model call')) },
    model: 'claude-sonnet-5-5',
    effort: 'low',
    shell: 'admin',
    firmName: 'SBC',
    snapshot: null,
    sources: [],
    history: [],
    message: 'When is the filing due?',
    language: 'English',
    depth: 'simple',
    decision: false,
    tools: [{ definition: { name: 'lookUp', description: 'Looks up.', input_schema: { type: 'object', properties: {} } }, run: async () => ({ due: '2026-11-30' }) }],
    validate: (raw) => ({ ok: true, answer: raw as AnswerEnvelope }),
    maxTotalTokens,
  };
}

describe('the answer budget', () => {
  it('keeps a finished answer from a reply that crosses the budget', async () => {
    const out = await generateAnswer(inputWith([reply([render], usage(2000))], 1000));
    expect(out.result).toMatchObject({ ok: true, answer: { line: 'Due on 30 November.' } });
  });

  it('counts cache writes, so a reply that only writes the cache can use up the budget', async () => {
    const out = await generateAnswer(inputWith([reply([lookUp], usage(100, 2000)), reply([render], usage(100))], 1000));
    expect(out.result).toMatchObject({ ok: false, overBudget: true });
    expect(out.toolCalls).toEqual([]);
  });

  it('stops a cut-off reply over the budget instead of asking again with more room', async () => {
    const out = await generateAnswer(inputWith([reply([], usage(2000), 'max_tokens'), reply([render], usage(100))], 1000));
    expect(out.result).toMatchObject({ ok: false, overBudget: true });
  });

  it('goes on to the next round while under the budget', async () => {
    const out = await generateAnswer(inputWith([reply([lookUp], usage(100)), reply([render], usage(100))], 1000));
    expect(out.result).toMatchObject({ ok: true });
  });
});
