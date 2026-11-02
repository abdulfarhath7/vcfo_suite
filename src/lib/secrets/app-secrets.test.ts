// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSecretsClientFactoryForTests } from './runtime-secret';
import { anthropicApiKey, azureClientSecret, isInvalidClient } from './app-secrets';

/**
 * M7: the Outlook token call and the Ask VCFO adapter read their secrets at runtime and
 * read them again when the provider refuses the cached value (invalid_client, 401).
 */

const created: Array<{ apiKey?: string }> = [];
let anthropicAnswers: Array<'ok' | 401> = [];

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    beta = {
      messages: {
        create: async () => {
          const next = anthropicAnswers.shift() ?? 'ok';
          if (next === 401) throw Object.assign(new Error('invalid x-api-key'), { status: 401 });
          return {
            model: 'm',
            content: [],
            stop_reason: 'end_turn',
            usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0 },
          };
        },
      },
    };
    constructor(opts: { apiKey?: string }) {
      created.push(opts);
    }
  }
  return { default: Anthropic };
});

function mockSecrets(values: string[]) {
  const send = vi.fn(async () => ({ SecretString: values.length > 1 ? values.shift()! : values[0]! }));
  setSecretsClientFactoryForTests(() => ({ send }));
  return send;
}

beforeEach(() => {
  azureClientSecret.invalidate();
  anthropicApiKey.invalidate();
  created.length = 0;
  anthropicAnswers = [];
});
afterEach(() => {
  setSecretsClientFactoryForTests(undefined);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('isInvalidClient', () => {
  it('knows a refused client secret', () => {
    expect(isInvalidClient({ code: 'invalid_client' })).toBe(true);
    expect(isInvalidClient({ status: 401 })).toBe(true);
    expect(isInvalidClient(new Error('AADSTS7000215: Invalid client secret provided.'))).toBe(true);
    expect(isInvalidClient({ code: 'invalid_grant', status: 400 })).toBe(false);
    expect(isInvalidClient(null)).toBe(false);
  });
});

describe('Outlook token call (AZURE_AD_CLIENT_SECRET_SECRET_ID)', () => {
  it('reads the secret again and retries once on invalid_client', async () => {
    vi.stubEnv('AZURE_AD_CLIENT_ID', 'client-1');
    vi.stubEnv('AZURE_AD_TENANT_ID', 'tenant-1');
    vi.stubEnv('AZURE_AD_CLIENT_SECRET', '');
    vi.stubEnv('AZURE_AD_CLIENT_SECRET_SECRET_ID', 'vcfo-suite/AZURE_AD_CLIENT_SECRET');
    const send = mockSecrets(['old-secret', 'new-secret']);
    const sent: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: URLSearchParams }) => {
        const secret = init.body.get('client_secret') ?? '';
        sent.push(secret);
        if (secret === 'old-secret') {
          return new Response(JSON.stringify({ error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided.' }), { status: 401 });
        }
        return new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt' }), { status: 200 });
      }),
    );
    const { outlookConfigured, refreshAccessToken } = await import('@/lib/outlook/oauth');
    expect(outlookConfigured()).toBe(true);
    const tokens = await refreshAccessToken('refresh-1');
    expect(tokens.access_token).toBe('at');
    expect(sent).toEqual(['old-secret', 'new-secret']);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('keeps the plain env var for local dev', async () => {
    vi.stubEnv('AZURE_AD_CLIENT_ID', 'client-1');
    vi.stubEnv('AZURE_AD_CLIENT_SECRET', 'local-secret');
    vi.stubEnv('AZURE_AD_CLIENT_SECRET_SECRET_ID', '');
    const send = mockSecrets(['never']);
    const sent: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: URLSearchParams }) => {
        sent.push(init.body.get('client_secret') ?? '');
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 });
      }),
    );
    const { exchangeCodeForTokens } = await import('@/lib/outlook/oauth');
    await exchangeCodeForTokens('code-1');
    expect(sent).toEqual(['local-secret']);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('Ask VCFO adapter (ANTHROPIC_API_KEY_SECRET_ID)', () => {
  const req = { model: 'm', system: [], messages: [], maxTokens: 10 };

  it('uses the key from Secrets Manager and retries once with the rotated key on a 401', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY_SECRET_ID', '/vcfo/ask-vcfo/anthropic-api-key');
    const send = mockSecrets(['sk-old', 'sk-new']);
    anthropicAnswers = [401, 'ok'];
    const { createAnthropicProvider } = await import('@/lib/ask/provider/anthropic');
    const provider = createAnthropicProvider({ refusalFallback: false });
    const out = await provider.complete(req);
    expect(out.stopReason).toBe('end_turn');
    expect(created.map((c) => c.apiKey)).toEqual(['sk-old', 'sk-new']);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('keeps one SDK client while the key does not change', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-local');
    vi.stubEnv('ANTHROPIC_API_KEY_SECRET_ID', '');
    const { createAnthropicProvider } = await import('@/lib/ask/provider/anthropic');
    const provider = createAnthropicProvider({ refusalFallback: false });
    await provider.complete(req);
    await provider.complete(req);
    expect(created.map((c) => c.apiKey)).toEqual(['sk-local']);
  });
});
