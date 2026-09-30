import 'server-only';

/**
 * Ask VCFO runtime configuration — env only, no model id hardcoded in logic
 * (defaults below are the documented fallbacks, ASK-VCFO-CONTEXT §10).
 */
export type AskProviderName = 'anthropic' | 'bedrock';

export interface AskConfig {
  enabled: boolean;
  provider: AskProviderName;
  models: { guard: string; answer: string; contextualizer: string };
  /** Effort for the answer model; guard / contextualizer run without it. */
  answerEffort: 'low' | 'medium' | 'high';
  rateLimit: { hour: number; day: number };
  retrievalTopK: number;
  bedrockRegion: string | null;
  /** Server-side refusal fallback (Claude API only). */
  refusalFallback: boolean;
}

function intEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export function askConfig(): AskConfig {
  const provider = process.env.ASK_VCFO_LLM_PROVIDER === 'bedrock' ? 'bedrock' : 'anthropic';
  const effort = process.env.ASK_VCFO_ANSWER_EFFORT;
  return {
    enabled: process.env.ASK_VCFO_ENABLED === 'true',
    provider,
    models: {
      guard: process.env.ASK_VCFO_MODEL_GUARD?.trim() || 'claude-haiku-4-5-20251001',
      answer: process.env.ASK_VCFO_MODEL_ANSWER?.trim() || 'claude-sonnet-5-5',
      contextualizer: process.env.ASK_VCFO_MODEL_CONTEXTUALIZER?.trim() || 'claude-haiku-4-5-20251001',
    },
    answerEffort: effort === 'low' || effort === 'high' ? effort : 'medium',
    rateLimit: { hour: intEnv('ASK_VCFO_RATE_LIMIT_HOUR', 30), day: intEnv('ASK_VCFO_RATE_LIMIT_DAY', 200) },
    retrievalTopK: intEnv('ASK_VCFO_RETRIEVAL_TOP_K', 8),
    bedrockRegion: process.env.ASK_VCFO_BEDROCK_REGION?.trim() || null,
    refusalFallback: process.env.ASK_VCFO_REFUSAL_FALLBACK !== 'false',
  };
}
