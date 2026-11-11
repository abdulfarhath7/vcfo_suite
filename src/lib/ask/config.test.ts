// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { askConfig } from './config';
import { INDIA_DEFAULT_MODELS } from './provider/residency';

const KEYS = ['ASK_VCFO_LLM_PROVIDER', 'ASK_VCFO_DATA_RESIDENCY', 'ASK_VCFO_BEDROCK_MODEL_FAST', 'ASK_VCFO_BEDROCK_MODEL_SMART', 'ASK_VCFO_BEDROCK_MODEL_DOCUMENT', 'ASK_VCFO_MODEL_AGENT'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const setEnv = (env: Record<string, string>) => {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
};

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('Ask model tiers', () => {
  it('map to India profile ids on Bedrock: the agent takes the smart model, the rest the fast one', () => {
    setEnv({ ASK_VCFO_LLM_PROVIDER: 'bedrock' });
    const config = askConfig();
    expect(config.dataResidency).toBe('india');
    expect(config.models.agent).toBe(INDIA_DEFAULT_MODELS.smart);
    for (const tier of ['guard', 'answer', 'contextualizer', 'document', 'extract', 'watch'] as const) {
      expect(config.models[tier]).toBe(INDIA_DEFAULT_MODELS.fast);
    }
  });

  it('take FAST, SMART and per-tier overrides', () => {
    setEnv({
      ASK_VCFO_LLM_PROVIDER: 'bedrock',
      ASK_VCFO_BEDROCK_MODEL_FAST: 'in.anthropic.fast-x',
      ASK_VCFO_BEDROCK_MODEL_SMART: 'in.anthropic.smart-x',
      ASK_VCFO_BEDROCK_MODEL_DOCUMENT: 'in.anthropic.claude-sonnet-5',
    });
    const { models } = askConfig();
    expect(models.guard).toBe('in.anthropic.fast-x');
    expect(models.agent).toBe('in.anthropic.smart-x');
    expect(models.document).toBe('in.anthropic.claude-sonnet-5');
  });

  it('keep the Anthropic API ids and residency none by default', () => {
    setEnv({ ASK_VCFO_MODEL_AGENT: 'claude-opus-5-5' });
    const config = askConfig();
    expect(config.provider).toBe('anthropic');
    expect(config.dataResidency).toBe('none');
    expect(config.models.guard).toBe('claude-haiku-5-5');
    expect(config.models.agent).toBe('claude-opus-5-5');
  });
});
