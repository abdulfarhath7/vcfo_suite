import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Encryption at rest for the TOTP secret in `profiles.totp_secret_enc` (G-25).
 *
 * KEY CHOICE: the key is derived from AUTH_SECRET (SHA-256 of a fixed label and
 * the secret), not from CREDENTIALS_ENCRYPTION_KEY. AUTH_SECRET is already
 * required wherever anyone can sign in, including App Runner, while the
 * credentials key is not set there yet. Anyone holding AUTH_SECRET can already
 * forge a session, so tying the TOTP secret to it adds no new exposure.
 *
 * ROTATION: changing AUTH_SECRET signs everyone out and makes every stored TOTP
 * secret unreadable. A person whose secret cannot be read is refused at the
 * code step, so after a rotation an admin must reset their two-step sign-in
 * (`POST /api/account/two-step/reset`) and they set it up again.
 *
 * Format: `t1:<iv b64>:<tag b64>:<data b64>`, AES-256-GCM, with the profile id
 * as additional authenticated data so a secret cannot be copied onto another
 * person's row.
 */

let cachedKey: Buffer | null = null;
let cachedFor: string | null = null;

function loadKey(): Buffer {
  const raw = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || '';
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is not set');
  }
  const seed = raw || 'vcfo-dev-only-totp-key';
  if (cachedKey && cachedFor === seed) return cachedKey;
  cachedKey = createHash('sha256').update(`totp-secret:v1:${seed}`).digest();
  cachedFor = seed;
  return cachedKey;
}

function aad(profileId: string): Buffer {
  return Buffer.from(`totp:${profileId}`, 'utf8');
}

export function encryptTotpSecret(profileId: string, secretBase32: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv);
  cipher.setAAD(aad(profileId));
  const data = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `t1:${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
}

/** The base32 secret, or null when the value is missing, malformed, or was sealed with another key or for another person. */
export function decryptTotpSecret(profileId: string, enc: string | null | undefined): string | null {
  if (!enc) return null;
  const [v, ivB, tagB, dataB] = enc.split(':');
  if (v !== 't1' || !ivB || !tagB || dataB == null) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', loadKey(), Buffer.from(ivB, 'base64'));
    decipher.setAAD(aad(profileId));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
