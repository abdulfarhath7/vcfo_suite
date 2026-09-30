import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, LlmRequest, LlmResult } from './index';

/**
 * Anthropic API adapter. System blocks carry their own `cache_control`
 * (set by generate.ts on the stable prefix). The server-side refusal
 * fallback is on by default so a classifier false positive is rescued by
 * another model inside the same call rather than failing the answer.
 */
export function createAnthropicProvider(opts: { refusalFallback: boolean }): LlmProvider {
  const client = new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return {
    name: 'anthropic',
    async complete(req: LlmRequest): Promise<LlmResult> {
      const response = await client.beta.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages,
        ...(req.tools && req.tools.length > 0 ? { tools: req.tools, tool_choice: { type: 'auto' } } : {}),
        ...(req.effort ? { output_config: { effort: req.effort } } : {}),
        ...(opts.refusalFallback
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
      });
      return {
        model: response.model,
        content: response.content,
        stopReason: response.stop_reason,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        },
      };
    },
  };
}
