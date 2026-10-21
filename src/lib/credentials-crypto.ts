import 'server-only';

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Encryption at rest for the credentials vault (AES-256-GCM) + OTP hashing.
 *
 * Key: env CREDENTIALS_ENCRYPTION_KEY — 32 bytes as base64 (44 chars) or hex
 * (64 chars). Generate one with `openssl rand -base64 32`. In production a
 * missing / malformed key is a hard error. In development, when it is unset,
 * a key is derived from AUTH_SECRET so local setup keeps working (warned once).
 * Rotating the key makes existing ciphertext unreadable — re-encrypt first.
 *
 * Ciphertext format: `v1:<iv b64>:<tag b64>:<data b64>`, with additional
 * authenticated data binding it to its engagement / sheet / row so a value
 * cannot be copied onto another row or tenant.
 */

let cachedKey: Buffer | null = null;
let warned = false;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (buf.length !== 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (base64 or hex)');
    cachedKey = buf;
    return buf;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set');
  }
  const seed = process.env.AUTH_SECRET?.trim() || 'vcfo-dev-only-credentials-key';
  if (!warned) {
    warned = true;
    console.warn('[credentials] CREDENTIALS_ENCRYPTION_KEY unset — using a dev key derived from AUTH_SECRET');
  }
  cachedKey = createHash('sha256').update(`credentials:${seed}`).digest();
  return cachedKey;
}

export function encryptSecrets(values: Record<string, string>, aad: string): string | null {
  const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => typeof v === 'string' && v !== ''));
  if (Object.keys(clean).length === 0) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const data = Buffer.concat([cipher.update(JSON.stringify(clean), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
}

export function decryptSecrets(ciphertext: string | null | undefined, aad: string): Record<string, string> {
  if (!ciphertext) return {};
  const [v, ivB, tagB, dataB] = ciphertext.split(':');
  if (v !== 'v1' || !ivB || !tagB || dataB == null) return {};
  try {
    const decipher = createDecipheriv('aes-256-gcm', loadKey(), Buffer.from(ivB, 'base64'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    const out = Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(out) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, x]) => typeof x === 'string')) as Record<string, string>;
  } catch (err) {
    console.error('[credentials] decrypt failed', err instanceof Error ? err.message : err);
    return {};
  }
}

/** Six random digits (crypto RNG). */
export function newOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** HMAC of the code bound to its OTP id — the only form stored. */
export function hashOtp(otpId: string, code: string): string {
  return createHmac('sha256', loadKey()).update(`otp:${otpId}:${code}`).digest('hex');
}

export function otpMatches(otpId: string, code: string, hash: string): boolean {
  const a = Buffer.from(hashOtp(otpId, code), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
