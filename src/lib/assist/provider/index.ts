import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';
import { assistConfig } from '@/lib/assist/config';

/**
 * Provider seam (OD1). Both adapters speak the Messages API shape, so the
 * pipeline never knows whether a call went to Anthropic or Bedrock.
 */
export type LlmMessage = Anthropic.Beta.BetaMessageParam;
export type LlmTool = Anthropic.Beta.BetaTool;
export type LlmSystemBlock = Anthropic.Beta.BetaTextBlockParam;
export type LlmContentBlock = Anthropic.Beta.BetaContentBlock;

export interface LlmRequest {
  model: string;
  system: LlmSystemBlock[];
  messages: LlmMessage[];
  tools?: LlmTool[];
  maxTokens: number;
  /** Only sent when set — models without effort support reject it. */
  effort?: 'low' | 'medium' | 'high';
}

export interface LlmResult {
  model: string;
  content: LlmContentBlock[];
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

export interface LlmProvider {
  readonly name: string;
  complete(req: LlmRequest): Promise<LlmResult>;
}

/** No credentials / misconfigured — callers answer "unavailable". */
export class LlmUnavailableError extends Error {
  constructor(message = 'Assist model provider is not configured') {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

let override: LlmProvider | null | undefined;

/** Tests inject a mock provider; `undefined` restores env resolution. */
export function setAssistProviderForTests(provider: LlmProvider | null | undefined): void {
  override = provider;
}

let cached: { key: string; provider: LlmProvider | null } | null = null;

/**
 * The configured provider, or null when no credentials exist locally
 * (mirrors the email console-skip: deterministic paths keep working).
 */
export async function getAssistProvider(): Promise<LlmProvider | null> {
  if (override !== undefined) return override;
  const config = assistConfig();
  const key = `${config.provider}:${config.bedrockRegion ?? ''}:${Boolean(process.env.ANTHROPIC_API_KEY)}`;
  if (cached?.key === key) return cached.provider;

  let provider: LlmProvider | null = null;
  if (config.provider === 'bedrock') {
    if (config.bedrockRegion) {
      const { createBedrockProvider } = await import('./bedrock');
      provider = createBedrockProvider(config.bedrockRegion);
    }
  } else if (process.env.ANTHROPIC_API_KEY?.trim()) {
    const { createAnthropicProvider } = await import('./anthropic');
    provider = createAnthropicProvider({ refusalFallback: config.refusalFallback });
  }
  cached = { key, provider };
  return provider;
}
