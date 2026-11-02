import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The rotating database password: the RDS-managed secret is read once and
 * cached for five minutes, a 28P01 from Postgres drops the cache so the next
 * connection reads the rotated value, and a secret without a password fails
 * loudly instead of logging in with an empty one.
 *
 * The Secrets Manager client is stubbed; `send` returns whatever each case sets.
 */

const send = vi.fn();

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: class {
    send = (...args: unknown[]) => send(...args);
  },
  GetSecretValueCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { getDbPassword, invalidateDbPassword } = await import('./db-password');

const ARN = 'arn:aws:secretsmanager:ap-south-1:123456789012:secret:rds!db-abc';

function secret(password?: string) {
  return { SecretString: JSON.stringify({ username: 'vcfo', password }) };
}

describe('getDbPassword', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T00:00:00Z'));
    invalidateDbPassword();
    send.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the secret once and serves the cache for five minutes', async () => {
    send.mockResolvedValueOnce(secret('first')).mockResolvedValueOnce(secret('second'));

    expect(await getDbPassword(ARN)).toBe('first');
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(await getDbPassword(ARN)).toBe('first');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input).toEqual({ SecretId: ARN });

    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(await getDbPassword(ARN)).toBe('second');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('reads the secret again at once after invalidateDbPassword', async () => {
    send.mockResolvedValueOnce(secret('old')).mockResolvedValueOnce(secret('rotated'));

    expect(await getDbPassword(ARN)).toBe('old');
    invalidateDbPassword();
    expect(await getDbPassword(ARN)).toBe('rotated');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('throws when the secret has no password and caches nothing', async () => {
    send.mockResolvedValueOnce(secret(undefined)).mockResolvedValueOnce({});

    await expect(getDbPassword(ARN)).rejects.toThrow('DB secret has no password field');
    await expect(getDbPassword(ARN)).rejects.toThrow('DB secret has no password field');
    expect(send).toHaveBeenCalledTimes(2);
  });
});
