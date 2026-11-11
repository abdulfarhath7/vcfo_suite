/**
 * India data residency for Ask VCFO (docs/specs/ask-vcfo/BEDROCK-INDIA.md).
 *
 * With `ASK_VCFO_DATA_RESIDENCY=india` (the default whenever the provider is Bedrock), every model
 * call must go to Amazon Bedrock's bedrock-runtime endpoint in Mumbai or Hyderabad and name an
 * India geographic inference profile (`in.` prefix). AWS documents that profile as routing only
 * between ap-south-1 and ap-south-2. A Global (`global.`), APAC (`apac.`), US (`us.`) or plain
 * `anthropic.` id can be processed outside India, so it is refused, and nothing ever falls back to
 * the Anthropic API.
 *
 * This file is pure (no SDK, no env reads) so the guard can be tested on its own.
 */

export type AskDataResidency = 'india' | 'none';

/** The two AWS regions the India profile routes between (AWS ML blog, 29 September 2026). */
export const INDIA_BEDROCK_REGIONS = ['ap-south-1', 'ap-south-2'] as const;

/** Every India geographic cross-region inference profile id starts with this. */
export const INDIA_MODEL_PREFIX = 'in.';

/**
 * Default India profile ids. They are taken from the AWS launch post of 29 September 2026, which
 * lists Claude Opus 5, Claude Sonnet 5 and Claude Haiku 4.5 for the India profile (not Haiku 5.5 or
 * Sonnet 5.5). CONFIRM both in the Mumbai console (Bedrock, Cross-region inference) before go-live;
 * override with ASK_VCFO_BEDROCK_MODEL_FAST and ASK_VCFO_BEDROCK_MODEL_SMART if they differ.
 */
export const INDIA_DEFAULT_MODELS = {
  fast: 'in.anthropic.claude-haiku-4-5-20251001-v1:0',
  smart: 'in.anthropic.claude-sonnet-5',
} as const;

/** A configuration that would let a prompt leave India. Never caught to fall back elsewhere. */
export class AskResidencyError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`Ask VCFO India data residency: ${problems.join(' ')}`);
    this.name = 'AskResidencyError';
    this.problems = problems;
  }
}

/** The residency mode: unset follows the provider; anything but `none` means India (fail closed on a typo). */
export function parseDataResidency(raw: string | undefined, provider: 'anthropic' | 'bedrock'): AskDataResidency {
  const value = raw?.trim().toLowerCase();
  if (!value) return provider === 'bedrock' ? 'india' : 'none';
  return value === 'none' ? 'none' : 'india';
}

export function isIndiaRegion(region: string | null | undefined): boolean {
  return !!region && (INDIA_BEDROCK_REGIONS as readonly string[]).includes(region);
}

export function isIndiaModelId(model: string | null | undefined): boolean {
  return !!model && model.startsWith(INDIA_MODEL_PREFIX) && model.length > INDIA_MODEL_PREFIX.length;
}

export function regionProblem(region: string | null | undefined): string | null {
  if (isIndiaRegion(region)) return null;
  return region
    ? `ASK_VCFO_BEDROCK_REGION is "${region}"; it must be ap-south-1 (Mumbai) or ap-south-2 (Hyderabad).`
    : 'ASK_VCFO_BEDROCK_REGION is not set; it must be ap-south-1 (Mumbai) or ap-south-2 (Hyderabad).';
}

export function modelProblem(tier: string, model: string | null | undefined): string | null {
  if (isIndiaModelId(model)) return null;
  return `The ${tier} model "${model ?? ''}" is not an India inference profile id (it must start with "in."; global., apac., us. and plain anthropic. ids can be processed outside India).`;
}

/** Throws before a request is sent when its model id is not an India profile id. */
export function assertIndiaModelId(model: string): void {
  const problem = modelProblem('requested', model);
  if (problem) throw new AskResidencyError([problem]);
}

export function assertIndiaRegion(region: string | null | undefined): void {
  const problem = regionProblem(region);
  if (problem) throw new AskResidencyError([problem]);
}

/** Everything wrong with a configuration for India residency; empty when it is safe. */
export function residencyProblems(config: {
  provider: 'anthropic' | 'bedrock';
  dataResidency: AskDataResidency;
  bedrockRegion: string | null;
  models: Record<string, string>;
}): string[] {
  if (config.dataResidency !== 'india') return [];
  if (config.provider !== 'bedrock') {
    return [
      'ASK_VCFO_LLM_PROVIDER is "anthropic", and the Anthropic API has no India processing option. Set ASK_VCFO_LLM_PROVIDER=bedrock, or ASK_VCFO_DATA_RESIDENCY=none to accept processing outside India.',
    ];
  }
  const problems: string[] = [];
  const region = regionProblem(config.bedrockRegion);
  if (region) problems.push(region);
  for (const [tier, model] of Object.entries(config.models)) {
    const problem = modelProblem(tier, model);
    if (problem) problems.push(problem);
  }
  return problems;
}

/** The startup check: throws one error naming every problem. */
export function assertResidency(config: Parameters<typeof residencyProblems>[0]): void {
  const problems = residencyProblems(config);
  if (problems.length > 0) throw new AskResidencyError(problems);
}
