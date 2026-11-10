// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmRequest } from './index';

const bedrockCreate = vi.fn();
const mantleCreate = vi.fn();
const anthropicCreate = vi.fn();
const bedrockOptions: unknown[] = [];

vi.mock('@anthropic-ai/bedrock-sdk', () => ({
  AnthropicBedrock: class {
    beta = { messages: { create: (...a: unknown[]) => bedrockCreate(...a) } };
    constructor(opts: unknown) {
      bedrockOptions.push(opts);
    }
  },
  AnthropicBedrockMantle: class {
    beta = { messages: { create: (...a: unknown[]) => mantleCreate(...a) } };
  },
}));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    beta = { messages: { create: (...a: unknown[]) => anthropicCreate(...a) } };
  },
}));
vi.mock('@/lib/secrets/app-secrets', () => ({
  anthropicApiKey: { configured: () => true, source: () => 'env', get: async () => 'key', invalidate: () => undefined },
}));

const { createBedrockIndiaProvider, AskBedrockError } = await import('./bedrock');
const { getAskProvider, resetAskProviderCacheForTests } = await import('./index');
const { AskResidencyError, INDIA_DEFAULT_MODELS } = await import('./residency');
const { estimateCostUsd } = await import('./pricing');

const reply = { model: 'claude-sonnet-5', content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 2 } };
const request = (model: string, extra: Partial<LlmRequest> = {}): LlmRequest => ({ model, system: [], messages: [{ role: 'user', content: 'hi' }], maxTokens: 10, ...extra });

const ENV_KEYS = [
  'ASK_VCFO_LLM_PROVIDER',
  'ASK_VCFO_DATA_RESIDENCY',
  'ASK_VCFO_BEDROCK_REGION',
  'ASK_VCFO_BEDROCK_MODEL_FAST',
  'ASK_VCFO_BEDROCK_MODEL_SMART',
  'ASK_VCFO_BEDROCK_MODEL_GUARD',
  'ASK_VCFO_MODEL_GUARD',
];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const setEnv = (env: Record<string, string>) => {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  resetAskProviderCacheForTests();
};

beforeEach(() => {
  for (const fn of [bedrockCreate, mantleCreate, anthropicCreate]) fn.mockReset();
  bedrockCreate.mockResolvedValue(reply);
  mantleCreate.mockResolvedValue(reply);
  anthropicCreate.mockResolvedValue(reply);
  bedrockOptions.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetAskProviderCacheForTests();
  vi.restoreAllMocks();
});

describe('the India Bedrock adapter', () => {
  it('uses bedrock-runtime in the given India region with a pinned base URL', () => {
    createBedrockIndiaProvider('ap-south-2');
    expect(bedrockOptions[0]).toMatchObject({ awsRegion: 'ap-south-2', baseURL: 'https://bedrock-runtime.ap-south-2.amazonaws.com' });
  });

  it('refuses a region outside India when it is built', () => {
    expect(() => createBedrockIndiaProvider('us-east-1')).toThrow(AskResidencyError);
  });

  it.each(['global.anthropic.claude-sonnet-5', 'apac.anthropic.claude-sonnet-5', 'us.anthropic.claude-sonnet-5', 'anthropic.claude-sonnet-5'])(
    'refuses %s on the call, before anything is sent',
    async (model) => {
      await expect(createBedrockIndiaProvider('ap-south-1').complete(request(model))).rejects.toThrow(AskResidencyError);
      expect(bedrockCreate).not.toHaveBeenCalled();
    },
  );

  it('sends an in. id unchanged and reports it as the model', async () => {
    const result = await createBedrockIndiaProvider('ap-south-1').complete(request('in.anthropic.claude-sonnet-5', { effort: 'low' }));
    expect(bedrockCreate.mock.calls[0]![0]).toMatchObject({ model: 'in.anthropic.claude-sonnet-5', output_config: { effort: 'low' } });
    expect(bedrockCreate.mock.calls[0]![0]).not.toHaveProperty('fallbacks');
    expect(result.model).toBe('in.anthropic.claude-sonnet-5');
  });

  it('leaves effort off Haiku 4.5, which rejects it, but keeps the output format', async () => {
    await createBedrockIndiaProvider('ap-south-1').complete(request(INDIA_DEFAULT_MODELS.fast, { effort: 'low', outputSchema: { type: 'object' } }));
    expect(bedrockCreate.mock.calls[0]![0].output_config).toEqual({ format: { type: 'json_schema', schema: { type: 'object' } } });
  });

  it('reports a Bedrock failure as a clear error', async () => {
    bedrockCreate.mockRejectedValue(new Error('AccessDeniedException'));
    await expect(createBedrockIndiaProvider('ap-south-1').complete(request('in.anthropic.claude-sonnet-5'))).rejects.toThrow(AskBedrockError);
  });
});

describe('provider selection', () => {
  it('picks the India adapter on Bedrock by default', async () => {
    setEnv({ ASK_VCFO_LLM_PROVIDER: 'bedrock', ASK_VCFO_BEDROCK_REGION: 'ap-south-1' });
    const provider = await getAskProvider();
    expect(provider?.name).toBe('bedrock-india');
    await provider!.complete(request(INDIA_DEFAULT_MODELS.smart));
    expect(bedrockCreate).toHaveBeenCalledOnce();
    expect(mantleCreate).not.toHaveBeenCalled();
  });

  it('never falls back to the Anthropic API when Bedrock fails in india mode', async () => {
    setEnv({ ASK_VCFO_LLM_PROVIDER: 'bedrock', ASK_VCFO_BEDROCK_REGION: 'ap-south-1' });
    bedrockCreate.mockRejectedValue(new Error('ThrottlingException'));
    const provider = await getAskProvider();
    await expect(provider!.complete(request(INDIA_DEFAULT_MODELS.fast))).rejects.toThrow(/Amazon Bedrock \(ap-south-1/);
    expect(anthropicCreate).not.toHaveBeenCalled();
    expect(mantleCreate).not.toHaveBeenCalled();
  });

  it('refuses every call when a tier names a Global profile', async () => {
    setEnv({ ASK_VCFO_LLM_PROVIDER: 'bedrock', ASK_VCFO_BEDROCK_REGION: 'ap-south-1', ASK_VCFO_BEDROCK_MODEL_GUARD: 'global.anthropic.claude-haiku-4-5' });
    const provider = await getAskProvider();
    expect(provider?.name).toBe('refused');
    await expect(provider!.complete(request(INDIA_DEFAULT_MODELS.fast))).rejects.toThrow(AskResidencyError);
    expect(console.error).toHaveBeenCalledOnce();
    expect(bedrockCreate).not.toHaveBeenCalled();
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it('refuses every call when the region is missing or outside India', async () => {
    for (const region of ['', 'us-east-1']) {
      setEnv({ ASK_VCFO_LLM_PROVIDER: 'bedrock', ASK_VCFO_BEDROCK_REGION: region });
      const provider = await getAskProvider();
      await expect(provider!.complete(request(INDIA_DEFAULT_MODELS.fast))).rejects.toThrow(/ASK_VCFO_BEDROCK_REGION/);
    }
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it('ignores ASK_VCFO_MODEL_* in india mode', async () => {
    setEnv({ ASK_VCFO_LLM_PROVIDER: 'bedrock', ASK_VCFO_BEDROCK_REGION: 'ap-south-1', ASK_VCFO_MODEL_GUARD: 'claude-haiku-5-5' });
    expect((await getAskProvider())?.name).toBe('bedrock-india');
  });

  it('refuses the Anthropic API when india residency is asked for', async () => {
    setEnv({ ASK_VCFO_LLM_PROVIDER: 'anthropic', ASK_VCFO_DATA_RESIDENCY: 'india' });
    const provider = await getAskProvider();
    await expect(provider!.complete(request('claude-haiku-5-5'))).rejects.toThrow(AskResidencyError);
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it('keeps the Anthropic API working, with a one-time warning that data leaves India', async () => {
    setEnv({ ASK_VCFO_LLM_PROVIDER: 'anthropic' });
    const provider = await getAskProvider();
    expect(provider?.name).toBe('anthropic');
    await provider!.complete(request('claude-haiku-5-5'));
    expect(anthropicCreate).toHaveBeenCalledOnce();
    await getAskProvider();
    expect(console.warn).toHaveBeenCalledOnce();
    expect(String(vi.mocked(console.warn).mock.calls[0]![0])).toMatch(/outside India/);
  });

  it('keeps the Mantle path only when residency is turned off', async () => {
    setEnv({ ASK_VCFO_LLM_PROVIDER: 'bedrock', ASK_VCFO_DATA_RESIDENCY: 'none', ASK_VCFO_BEDROCK_REGION: 'us-east-1' });
    const provider = await getAskProvider();
    expect(provider?.name).toBe('bedrock');
    await provider!.complete(request('claude-haiku-5-5'));
    expect(mantleCreate.mock.calls[0]![0]).toMatchObject({ model: 'anthropic.claude-haiku-5-5' });
  });
});

describe('pricing for the India profile', () => {
  it('knows the India ids and adds the regional premium', () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(estimateCostUsd('in.anthropic.claude-haiku-4-5-20251001-v1:0', usage)).toBeCloseTo(1.1);
    expect(estimateCostUsd('in.anthropic.claude-sonnet-5', usage)).toBeCloseTo(2.2);
    expect(estimateCostUsd('in.anthropic.claude-opus-5', usage)).toBeCloseTo(5.5);
    expect(estimateCostUsd('claude-opus-5-5', usage)).toBeCloseTo(4);
  });
});
