import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptTotpSecret, encryptTotpSecret, reencryptTotpSecret } from './secret-box';

const KEY = randomBytes(32).toString('base64');
const OTHER_KEY = randomBytes(32).toString('base64');
const SECRET = 'GEZDGNBVGY3TQOJQ';

/** A `t1` value exactly as the pre-M7 code sealed it (key = sha256("totp-secret:v1:" + AUTH_SECRET)). */
function legacySeal(authSecret: string, profileId: string, plain: string): string {
  const key = createHash('sha256').update(`totp-secret:v1:${authSecret}`).digest();
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(`totp:${profileId}`, 'utf8'));
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `t1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}

describe('TOTP secret box', () => {
  it('round-trips for the same person', () => {
    const enc = encryptTotpSecret('p1', SECRET);
    expect(enc).not.toContain(SECRET);
    expect(decryptTotpSecret('p1', enc)).toBe(SECRET);
  });

  it('will not open a secret copied onto another person', () => {
    const enc = encryptTotpSecret('p1', SECRET);
    expect(decryptTotpSecret('p2', enc)).toBeNull();
  });

  it('returns null for missing or malformed values', () => {
    expect(decryptTotpSecret('p1', null)).toBeNull();
    expect(decryptTotpSecret('p1', 'v1:a:b:c')).toBeNull();
    expect(decryptTotpSecret('p1', 't1:AAAA:AAAA:AAAA')).toBeNull();
    expect(decryptTotpSecret('p1', 't2:AAAA:AAAA:AAAA', { CREDENTIALS_ENCRYPTION_KEY: KEY })).toBeNull();
  });
});

describe('TOTP secret box with CREDENTIALS_ENCRYPTION_KEY (M7)', () => {
  const env = { NODE_ENV: 'production', AUTH_SECRET: 'auth-a', CREDENTIALS_ENCRYPTION_KEY: KEY };

  it('seals new values as t2 with the credentials key', () => {
    const enc = encryptTotpSecret('p1', SECRET, env);
    expect(enc.startsWith('t2:')).toBe(true);
    expect(decryptTotpSecret('p1', enc, env)).toBe(SECRET);
  });

  it('keeps t2 values readable after AUTH_SECRET rotates', () => {
    const enc = encryptTotpSecret('p1', SECRET, env);
    expect(decryptTotpSecret('p1', enc, { ...env, AUTH_SECRET: 'auth-b' })).toBe(SECRET);
    expect(decryptTotpSecret('p1', enc, { NODE_ENV: 'production', CREDENTIALS_ENCRYPTION_KEY: KEY })).toBe(SECRET);
  });

  it('does not open t2 values with another credentials key', () => {
    const enc = encryptTotpSecret('p1', SECRET, env);
    expect(decryptTotpSecret('p1', enc, { ...env, CREDENTIALS_ENCRYPTION_KEY: OTHER_KEY })).toBeNull();
  });

  it('opens old t1 values with AUTH_SECRET', () => {
    const old = legacySeal('auth-a', 'p1', SECRET);
    expect(decryptTotpSecret('p1', old, env)).toBe(SECRET);
  });

  it('opens old t1 values with AUTH_SECRET_PREVIOUS after a rotation', () => {
    const old = legacySeal('auth-a', 'p1', SECRET);
    const rotated = { ...env, AUTH_SECRET: 'auth-b', AUTH_SECRET_PREVIOUS: 'auth-a' };
    expect(decryptTotpSecret('p1', old, rotated)).toBe(SECRET);
    expect(decryptTotpSecret('p1', old, { ...env, AUTH_SECRET: 'auth-b' })).toBeNull();
  });

  it('falls back to t1 with AUTH_SECRET while the credentials key is unset', () => {
    const noKey = { NODE_ENV: 'production', AUTH_SECRET: 'auth-a' };
    const enc = encryptTotpSecret('p1', SECRET, noKey);
    expect(enc.startsWith('t1:')).toBe(true);
    expect(decryptTotpSecret('p1', enc, noKey)).toBe(SECRET);
    expect(() => encryptTotpSecret('p1', SECRET, { NODE_ENV: 'production' })).toThrow(/AUTH_SECRET/);
  });
});

describe('reencryptTotpSecret', () => {
  const env = { NODE_ENV: 'production', AUTH_SECRET: 'auth-b', AUTH_SECRET_PREVIOUS: 'auth-a', CREDENTIALS_ENCRYPTION_KEY: KEY };

  it('moves a t1 value to t2', () => {
    const out = reencryptTotpSecret('p1', legacySeal('auth-a', 'p1', SECRET), env);
    expect(out.state).toBe('moved');
    if (out.state !== 'moved') return;
    expect(out.enc.startsWith('t2:')).toBe(true);
    expect(decryptTotpSecret('p1', out.enc, { NODE_ENV: 'production', CREDENTIALS_ENCRYPTION_KEY: KEY })).toBe(SECRET);
  });

  it('leaves t2 values alone and reports unreadable ones', () => {
    expect(reencryptTotpSecret('p1', encryptTotpSecret('p1', SECRET, env), env)).toEqual({ state: 'current' });
    expect(reencryptTotpSecret('p1', legacySeal('auth-z', 'p1', SECRET), env)).toEqual({ state: 'unreadable' });
  });

  it('refuses to run without the credentials key', () => {
    expect(() => reencryptTotpSecret('p1', legacySeal('auth-a', 'p1', SECRET), { AUTH_SECRET: 'auth-a' })).toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
  });
});
