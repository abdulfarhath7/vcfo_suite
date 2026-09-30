import 'server-only';

/**
 * Assist runtime configuration — env only, no model id hardcoded in logic
 * (defaults below are the documented fallbacks, VCFO-ASSIST-CONTEXT §10).
 */
export type AssistProviderName = 'anthropic' | 'bedrock';

export interface AssistConfig {
  enabled: boolean;
  provider: AssistProviderName;
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

export function assistConfig(): AssistConfig {
  const provider = process.env.ASSIST_LLM_PROVIDER === 'bedrock' ? 'bedrock' : 'anthropic';
  const effort = process.env.ASSIST_ANSWER_EFFORT;
  return {
    enabled: process.env.ASSIST_ENABLED === 'true',
    provider,
    models: {
      guard: process.env.ASSIST_MODEL_GUARD?.trim() || 'claude-haiku-4-5-20251001',
      answer: process.env.ASSIST_MODEL_ANSWER?.trim() || 'claude-sonnet-5-5',
      contextualizer: process.env.ASSIST_MODEL_CONTEXTUALIZER?.trim() || 'claude-haiku-4-5-20251001',
    },
    answerEffort: effort === 'low' || effort === 'high' ? effort : 'medium',
    rateLimit: { hour: intEnv('ASSIST_RATE_LIMIT_HOUR', 30), day: intEnv('ASSIST_RATE_LIMIT_DAY', 200) },
    retrievalTopK: intEnv('ASSIST_RETRIEVAL_TOP_K', 8),
    bedrockRegion: process.env.ASSIST_BEDROCK_REGION?.trim() || null,
    refusalFallback: process.env.ASSIST_REFUSAL_FALLBACK !== 'false',
  };
}
