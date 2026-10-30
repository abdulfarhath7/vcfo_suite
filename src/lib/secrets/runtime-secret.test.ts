import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import {
  RUNTIME_SECRET_RETRY_MS,
  RUNTIME_SECRET_TTL_MS,
  pickSecretValue,
  runtimeSecret,
  secretRegion,
  setSecretsClientFactoryForTests,
  withSecretRetry,
} from './runtime-secret';

/** A mocked Secrets Manager client: `values` are answered in turn; the last one repeats. */
function mockClient(values: Array<string | Error>) {
  const send = vi.fn(async (cmd: GetSecretValueCommand) => {
    void cmd;
    const v = values.length > 1 ? values.shift()! : values[0]!;
    if (v instanceof Error) throw v;
    return { SecretString: v };
  });
  const regions: Array<string | undefined> = [];
  setSecretsClientFactoryForTests((region) => {
    regions.push(region);
    return { send };
  });
  return { send, regions };
}

const ARN = 'arn:aws:secretsmanager:ap-south-1:600627321277:secret:/vcfo/ask-vcfo/anthropic-api-key-AbC123';

function makeSecret(env: Record<string, string | undefined>, clock = { t: 0 }) {
  return runtimeSecret({ envVar: 'API_KEY', secretIdVar: 'API_KEY_SECRET_ID', env: () => env, now: () => clock.t });
}

afterEach(() => setSecretsClientFactoryForTests(undefined));

describe('runtimeSecret', () => {
  it('uses the plain env var when no secret id is set (local dev)', async () => {
    const { send } = mockClient(['from-sm']);
    const s = makeSecret({ API_KEY: ' local-key ' });
    expect(s.source()).toBe('env');
    expect(await s.get()).toBe('local-key');
    expect(send).not.toHaveBeenCalled();
  });

  it('reports nothing configured when neither env var is set', async () => {
    const s = makeSecret({});
    expect(s.configured()).toBe(false);
    expect(await s.get()).toBeUndefined();
  });

  it('reads Secrets Manager when the secret id is set, and prefers it over the env var', async () => {
    const { send, regions } = mockClient(['sm-key']);
    const s = makeSecret({ API_KEY: 'stale', API_KEY_SECRET_ID: ARN });
    expect(s.source()).toBe('secrets_manager');
    expect(await s.get()).toBe('sm-key');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].input).toEqual({ SecretId: ARN });
    expect(regions).toEqual(['ap-south-1']);
  });

  it('caches for the TTL and reads again after it', async () => {
    const clock = { t: 0 };
    const { send } = mockClient(['v1', 'v2']);
    const s = makeSecret({ API_KEY_SECRET_ID: ARN }, clock);
    expect(await s.get()).toBe('v1');
    clock.t = RUNTIME_SECRET_TTL_MS - 1;
    expect(await s.get()).toBe('v1');
    expect(send).toHaveBeenCalledTimes(1);
    clock.t = RUNTIME_SECRET_TTL_MS + 1;
    expect(await s.get()).toBe('v2');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('reads again at once after invalidate()', async () => {
    const { send } = mockClient(['v1', 'v2']);
    const s = makeSecret({ API_KEY_SECRET_ID: ARN });
    expect(await s.get()).toBe('v1');
    s.invalidate();
    expect(await s.get()).toBe('v2');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('shares one call between parallel reads', async () => {
    const { send } = mockClient(['v1']);
    const s = makeSecret({ API_KEY_SECRET_ID: ARN });
    const [a, b] = await Promise.all([s.get(), s.get()]);
    expect([a, b]).toEqual(['v1', 'v1']);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not hammer Secrets Manager after a failure', async () => {
    const clock = { t: 0 };
    const { send } = mockClient([new Error('AccessDeniedException'), 'v1']);
    const s = makeSecret({ API_KEY_SECRET_ID: ARN }, clock);
    await expect(s.get()).rejects.toThrow(/AccessDenied/);
    await expect(s.get()).rejects.toThrow(/AccessDenied/);
    expect(send).toHaveBeenCalledTimes(1);
    clock.t = RUNTIME_SECRET_RETRY_MS + 1;
    expect(await s.get()).toBe('v1');
  });
});

describe('pickSecretValue and secretRegion', () => {
  it('takes plain text, a named JSON field or the only JSON string', () => {
    expect(pickSecretValue('  sk-ant-1 ')).toBe('sk-ant-1');
    expect(pickSecretValue('{"apiKey":"k1","note":"x"}', ['apiKey'])).toBe('k1');
    expect(pickSecretValue('{"whatever":"k2"}', ['apiKey'])).toBe('k2');
    expect(pickSecretValue('{"a":"1","b":"2"}', ['apiKey'])).toBeUndefined();
    expect(pickSecretValue('')).toBeUndefined();
  });

  it('takes the region from an ARN, else AWS_REGION', () => {
    expect(secretRegion(ARN, {})).toBe('ap-south-1');
    expect(secretRegion('vcfo-suite/AZURE_AD_CLIENT_SECRET', { AWS_REGION: 'eu-west-1' })).toBe('eu-west-1');
  });
});

describe('withSecretRetry', () => {
  const rejected = (err: unknown) => (err as { status?: number }).status === 401;

  it('drops the cache and retries once with the rotated value on a refusal', async () => {
    const { send } = mockClient(['old', 'new']);
    const s = makeSecret({ API_KEY_SECRET_ID: ARN });
    const used: string[] = [];
    const out = await withSecretRetry(
      s,
      async (v) => {
        used.push(v);
        if (v === 'old') throw Object.assign(new Error('unauthorized'), { status: 401 });
        return 'answered';
      },
      rejected,
    );
    expect(out).toBe('answered');
    expect(used).toEqual(['old', 'new']);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not retry when the value did not change, or for other errors, or for env values', async () => {
    mockClient(['same']);
    const s = makeSecret({ API_KEY_SECRET_ID: ARN });
    const fn = vi.fn(async () => {
      throw Object.assign(new Error('unauthorized'), { status: 401 });
    });
    await expect(withSecretRetry(s, fn, rejected)).rejects.toThrow('unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);

    const other = vi.fn(async () => {
      throw Object.assign(new Error('overloaded'), { status: 529 });
    });
    await expect(withSecretRetry(s, other, rejected)).rejects.toThrow('overloaded');
    expect(other).toHaveBeenCalledTimes(1);

    const local = makeSecret({ API_KEY: 'k' });
    const envFn = vi.fn(async () => {
      throw Object.assign(new Error('unauthorized'), { status: 401 });
    });
    await expect(withSecretRetry(local, envFn, rejected)).rejects.toThrow('unauthorized');
    expect(envFn).toHaveBeenCalledTimes(1);
  });
});
