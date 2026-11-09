import type { LlmUsage } from './index';

/**
 * List prices in USD per million tokens, for reports only; a bill can differ (Bedrock has its own
 * rates). Cache reads cost 0.1x of input, unless the model says otherwise, and 5-minute cache writes
 * 1.25x. A refused turn re-run by the server's fallback is billed on the model it landed on, so the
 * models a fallback can reach are listed too. A longer id comes first, as an id matches by its part.
 * An unknown model has no price, and the report names it rather than counting it as free.
 */
const PRICES: ReadonlyArray<{ match: string; input: number; output: number; cacheRead?: number; longPromptOver?: number }> = [
  // Haiku 5.5's list price is five times higher for a prompt past 100K tokens, which a scanned PDF reaches.
  { match: 'haiku-5-5', input: 0.1, output: 0.5, longPromptOver: 100_000 },
  { match: 'haiku-4-5', input: 1, output: 5 },
  { match: 'sonnet-5-5', input: 2, output: 10 },
  { match: 'sonnet-5', input: 2, output: 10 },
  { match: 'sonnet-4-6', input: 3, output: 15 },
  { match: 'opus-5-5', input: 4, output: 20, cacheRead: 0.05 },
  { match: 'opus-5', input: 5, output: 25 },
  { match: 'opus-4-8', input: 5, output: 25 },
  { match: 'opus-4-7', input: 5, output: 25 },
  { match: 'opus-4-6', input: 5, output: 25 },
  { match: 'fable-5-1', input: 10, output: 50, cacheRead: 0.025 },
  { match: 'fable-5', input: 10, output: 50 },
];

/** The estimate, or null for a model with no price that spent tokens. */
export function estimateCostUsd(model: string, usage: LlmUsage): number | null {
  const price = PRICES.find((p) => model.includes(p.match));
  if (!price) return totalTokens(usage) === 0 ? 0 : null;
  const input = usage.inputTokens + usage.cacheReadTokens * (price.cacheRead ?? 0.1) + usage.cacheWriteTokens * 1.25;
  return (input * price.input + usage.outputTokens * price.output) / 1_000_000;
}

/**
 * True when spend summed over calls is large enough to hold one prompt past the model's long-prompt
 * threshold. The estimate prices every token at the short rate, so it is then only a lower bound.
 */
export function mayUnderstate(model: string, usage: LlmUsage): boolean {
  const over = PRICES.find((p) => model.includes(p.match))?.longPromptOver;
  return over !== undefined && usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens > over;
}

/** Everything the model read or wrote, cached or not. */
export function totalTokens(usage: LlmUsage): number {
  return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}
