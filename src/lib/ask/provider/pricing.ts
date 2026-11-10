import type { LlmUsage } from './index';

/**
 * List prices in USD per million tokens, for reports only; a bill can differ. Cache reads cost 0.1x
 * of input and 5-minute cache writes 1.25x. An unknown model costs 0. Ids match by substring, so
 * `in.anthropic.claude-sonnet-5` and `claude-sonnet-5` share a row; longer names come first so
 * `sonnet-5-5` is not priced as `sonnet-5`.
 *
 * Bedrock India profile ids (`in.`) are priced at the Anthropic list price plus the 10 percent
 * premium Bedrock charges for regional and geographic endpoints. That premium is an estimate:
 * confirm the ap-south-1 rates on the Bedrock pricing page.
 */
const PRICES: ReadonlyArray<{ match: string; input: number; output: number }> = [
  { match: 'haiku-5-5', input: 0.1, output: 0.5 },
  { match: 'haiku-4-5', input: 1, output: 5 },
  { match: 'sonnet-5-5', input: 2, output: 10 },
  { match: 'sonnet-5', input: 2, output: 10 },
  { match: 'opus-5-5', input: 4, output: 20 },
  { match: 'opus-5', input: 5, output: 25 },
];

/** The multiplier on list price for the Bedrock India geographic profile (estimate, see above). */
export const INDIA_PROFILE_PREMIUM = 1.1;

export function estimateCostUsd(model: string, usage: LlmUsage): number {
  const price = PRICES.find((p) => model.includes(p.match));
  if (!price) return 0;
  const input = usage.inputTokens + usage.cacheReadTokens * 0.1 + usage.cacheWriteTokens * 1.25;
  const premium = model.startsWith('in.') ? INDIA_PROFILE_PREMIUM : 1;
  return ((input * price.input + usage.outputTokens * price.output) / 1_000_000) * premium;
}

/** Everything the model read or wrote, cached or not. */
export function totalTokens(usage: LlmUsage): number {
  return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}
