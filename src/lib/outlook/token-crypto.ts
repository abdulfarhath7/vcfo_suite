import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { authSecrets } from '@/auth/secrets';

const PREFIX = 'v1';

/**
 * Keys derived from the Auth.js secrets, current first (src/auth/secrets.ts). New blobs are
 * sealed with AUTH_SECRET. A blob sealed before a rotation still opens with
 * AUTH_SECRET_PREVIOUS, and the connection re-seals its tokens with the current key at the
 * next refresh, so a rotation does not disconnect Outlook.
 */
function keysFromSecrets(): Buffer[] {
  const secrets = authSecrets();
  if (secrets.length === 0) throw new Error('AUTH_SECRET is required to store Outlook tokens');
  return secrets.map((s) => createHash('sha256').update(s).digest());
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keysFromSecrets()[0]!, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}.${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

export function decryptSecret(packed: string): string {
  const parts = packed.split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('invalid_token_blob');
  }
  const iv = Buffer.from(parts[1]!, 'base64url');
  const tag = Buffer.from(parts[2]!, 'base64url');
  const data = Buffer.from(parts[3]!, 'base64url');
  let last: unknown;
  for (const key of keysFromSecrets()) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error('invalid_token_blob');
}
