import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { credentialsKeyFromEnv } from '@/lib/credentials-crypto';

/**
 * Encryption at rest for the TOTP secret in `profiles.totp_secret_enc` (G-25, M7).
 *
 * KEY CHOICE (M7): new values are sealed with a key derived from
 * CREDENTIALS_ENCRYPTION_KEY (format `t2`). That key does not change when AUTH_SECRET
 * rotates, so a rotation no longer makes two-step sign-in unreadable.
 *
 * OLD VALUES: format `t1` was sealed with a key derived from AUTH_SECRET. They still open
 * with AUTH_SECRET or with AUTH_SECRET_PREVIOUS, so they keep working through one rotation.
 * `scripts/reencrypt-totp.ts` moves every `t1` value to `t2` once; run it after
 * CREDENTIALS_ENCRYPTION_KEY is set and before the next AUTH_SECRET rotation.
 *
 * BEFORE THE KEY IS SET: when CREDENTIALS_ENCRYPTION_KEY is unset, new values are still
 * sealed as `t1` (warned once), so two-step setup keeps working on a server that does not
 * have the key yet. The re-encrypt script moves them later.
 *
 * Format: `<t1|t2>:<iv b64>:<tag b64>:<data b64>`, AES-256-GCM, with the profile id as
 * additional authenticated data so a secret cannot be copied onto another person's row.
 */

type Env = Record<string, string | undefined>;

const DEV_SEED = 'vcfo-dev-only-totp-key';

const keyCache = new Map<string, Buffer>();
let warned = false;

function derive(label: string, material: string | Buffer): Buffer {
  const id = `${label}:${typeof material === 'string' ? material : material.toString('base64')}`;
  const hit = keyCache.get(id);
  if (hit) return hit;
  const key = createHash('sha256').update(`${label}:`).update(material).digest();
  keyCache.set(id, key);
  return key;
}

/** The `t2` key, or null when CREDENTIALS_ENCRYPTION_KEY is unset. */
function currentKey(env: Env): Buffer | null {
  const bytes = credentialsKeyFromEnv(env);
  return bytes ? derive('totp-secret:v2', bytes) : null;
}

/**
 * The `t1` keys to try, current first: AUTH_SECRET (or NEXTAUTH_SECRET), then
 * AUTH_SECRET_PREVIOUS. Outside production the dev seed stands in when no secret is set.
 * The derivation matches the original `sha256("totp-secret:v1:" + seed)`.
 */
function legacyKeys(env: Env): Buffer[] {
  const current = env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim() || '';
  const previous = env.AUTH_SECRET_PREVIOUS?.trim() || '';
  const seeds = [current, previous].filter(Boolean);
  if (seeds.length === 0 && env.NODE_ENV !== 'production') seeds.push(DEV_SEED);
  return [...new Set(seeds)].map((s) => derive('totp-secret:v1', s));
}

function aad(profileId: string): Buffer {
  return Buffer.from(`totp:${profileId}`, 'utf8');
}

function seal(version: 't1' | 't2', key: Buffer, profileId: string, secretBase32: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(profileId));
  const data = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${version}:${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
}

function open(key: Buffer, profileId: string, ivB: string, tagB: string, dataB: string): string | null {
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
    decipher.setAAD(aad(profileId));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function encryptTotpSecret(profileId: string, secretBase32: string, env: Env = process.env): string {
  const key = currentKey(env);
  if (key) return seal('t2', key, profileId, secretBase32);
  const legacy = legacyKeys(env)[0];
  if (!legacy) throw new Error('AUTH_SECRET is not set');
  if (!warned && env.NODE_ENV === 'production') {
    warned = true;
    console.warn('[totp] CREDENTIALS_ENCRYPTION_KEY unset: sealing with AUTH_SECRET (t1) until it is set');
  }
  return seal('t1', legacy, profileId, secretBase32);
}

/** The base32 secret, or null when the value is missing, malformed, or was sealed with another key or for another person. */
export function decryptTotpSecret(profileId: string, enc: string | null | undefined, env: Env = process.env): string | null {
  if (!enc) return null;
  const [v, ivB, tagB, dataB] = enc.split(':');
  if (!ivB || !tagB || dataB == null) return null;
  if (v === 't2') {
    const key = currentKey(env);
    return key ? open(key, profileId, ivB, tagB, dataB) : null;
  }
  if (v === 't1') {
    for (const key of legacyKeys(env)) {
      const out = open(key, profileId, ivB, tagB, dataB);
      if (out !== null) return out;
    }
  }
  return null;
}

export type ReencryptResult =
  | { state: 'moved'; enc: string }
  | { state: 'current' }
  | { state: 'unreadable' };

/**
 * One stored value moved to `t2` for the re-encrypt script. `current` means it is already
 * `t2`; `unreadable` means no known key opens it (the person needs a two-step reset).
 * Throws when CREDENTIALS_ENCRYPTION_KEY is unset, because there is nothing to move to.
 */
export function reencryptTotpSecret(profileId: string, enc: string, env: Env = process.env): ReencryptResult {
  if (!currentKey(env)) throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set');
  if (enc.startsWith('t2:')) return decryptTotpSecret(profileId, enc, env) === null ? { state: 'unreadable' } : { state: 'current' };
  const plain = decryptTotpSecret(profileId, enc, env);
  if (plain === null) return { state: 'unreadable' };
  return { state: 'moved', enc: encryptTotpSecret(profileId, plain, env) };
}
