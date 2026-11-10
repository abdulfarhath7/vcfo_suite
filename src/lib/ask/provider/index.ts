import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';
import { askConfig } from '@/lib/ask/config';
import { anthropicApiKey } from '@/lib/secrets/app-secrets';
import { AskResidencyError, residencyProblems } from './residency';

/**
 * Provider seam (OD1). Both adapters speak the Messages API shape, so the
 * pipeline never knows whether a call went to Anthropic or Bedrock.
 */
export type LlmMessage = Anthropic.Beta.BetaMessageParam;
export type LlmTool = Anthropic.Beta.BetaTool;
export type LlmSystemBlock = Anthropic.Beta.BetaTextBlockParam;
type LlmContentBlock = Anthropic.Beta.BetaContentBlock;

export interface LlmRequest {
  model: string;
  system: LlmSystemBlock[];
  messages: LlmMessage[];
  tools?: LlmTool[];
  maxTokens: number;
  /** Only sent when set — models without effort support reject it. */
  effort?: 'low' | 'medium' | 'high';
  /** Turns thinking off on a route that only classifies; everywhere else effort is the lever. */
  thinking?: 'off';
  /** Asks for JSON matching this schema as the reply, which costs far fewer tokens than a tool call. */
  outputSchema?: Record<string, unknown>;
  /** Per-request timeout (ms) for long jobs such as document transcription. */
  timeoutMs?: number;
}

export interface LlmUsage {
  /** Uncached input only; cache reads and writes are counted apart, as the API reports them. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const NO_LLM_USAGE: LlmUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export function addLlmUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

export interface LlmResult {
  model: string;
  content: LlmContentBlock[];
  stopReason: string | null;
  usage: LlmUsage;
}

/** The `output_config` for a request, or nothing when it sets neither effort nor a format. */
export function outputConfigFor(req: LlmRequest) {
  if (!req.effort && !req.outputSchema) return {};
  return {
    output_config: {
      ...(req.effort ? { effort: req.effort } : {}),
      ...(req.outputSchema ? { format: { type: 'json_schema' as const, schema: req.outputSchema } } : {}),
    },
  };
}

/** The one mapping from an API response to the seam, shared by both adapters. A refusal carries no content. */
export function toLlmResult(response: Anthropic.Beta.BetaMessage): LlmResult {
  return {
    model: response.model,
    content: response.stop_reason === 'refusal' ? [] : response.content,
    stopReason: response.stop_reason,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

export interface LlmProvider {
  readonly name: string;
  complete(req: LlmRequest): Promise<LlmResult>;
}

let override: LlmProvider | null | undefined;

/** Tests inject a mock provider; `undefined` restores env resolution. */
export function setAskProviderForTests(provider: LlmProvider | null | undefined): void {
  override = provider;
}

let cached: { key: string; provider: LlmProvider | null } | null = null;
let warnedOutsideIndia = false;
let loggedResidencyError = '';

/**
 * A provider that refuses every call with the residency error, so a misconfigured India setup
 * fails loudly on each path (the pipeline shows "unavailable") and never falls back elsewhere.
 */
function refusingProvider(error: AskResidencyError): LlmProvider {
  return { name: 'refused', complete: () => Promise.reject(error) };
}

/**
 * The configured provider, or null when no credentials exist locally
 * (mirrors the email console-skip: deterministic paths keep working).
 *
 * RESIDENCY: with ASK_VCFO_DATA_RESIDENCY=india (the default for Bedrock) the configuration is
 * checked here, at first use, and a bad one yields a provider that refuses every call with an
 * AskResidencyError. There is no fallback to the Anthropic API or to a Global profile.
 */
export async function getAskProvider(): Promise<LlmProvider | null> {
  if (override !== undefined) return override;
  const config = askConfig();
  // The key's source only (env or Secrets Manager); the value is read per call (M7).
  const key = JSON.stringify([config.provider, config.dataResidency, config.bedrockRegion, config.models, anthropicApiKey.source()]);
  if (cached?.key === key) return cached.provider;

  let provider: LlmProvider | null = null;
  const problems = residencyProblems(config);
  if (problems.length > 0) {
    const error = new AskResidencyError(problems);
    if (loggedResidencyError !== error.message) {
      loggedResidencyError = error.message;
      console.error(`[ask-vcfo] refusing every model call: ${error.message}`);
    }
    provider = refusingProvider(error);
  } else if (config.provider === 'bedrock') {
    if (config.dataResidency === 'india') {
      const { createBedrockIndiaProvider } = await import('./bedrock');
      provider = createBedrockIndiaProvider(config.bedrockRegion!);
    } else if (config.bedrockRegion) {
      const { createBedrockProvider } = await import('./bedrock');
      provider = createBedrockProvider(config.bedrockRegion);
    }
  } else if (anthropicApiKey.configured()) {
    if (!warnedOutsideIndia) {
      warnedOutsideIndia = true;
      console.warn(
        '[ask-vcfo] ASK_VCFO_LLM_PROVIDER=anthropic: prompts are processed by the Anthropic API outside India. Use Bedrock with ASK_VCFO_DATA_RESIDENCY=india in production (docs/specs/ask-vcfo/BEDROCK-INDIA.md).',
      );
    }
    const { createAnthropicProvider } = await import('./anthropic');
    provider = createAnthropicProvider({ refusalFallback: config.refusalFallback });
  }
  cached = { key, provider };
  return provider;
}

/** Tests only: forget the resolved provider and the one-time log lines. */
export function resetAskProviderCacheForTests(): void {
  cached = null;
  warnedOutsideIndia = false;
  loggedResidencyError = '';
}
