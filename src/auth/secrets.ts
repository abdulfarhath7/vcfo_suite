/**
 * The Auth.js signing secrets, newest first (M7: AUTH_SECRET rotation without sign-outs).
 *
 * AUTH_SECRET is the current secret. AUTH_SECRET_PREVIOUS is optional and holds the secret
 * that was current before the last rotation. Auth.js signs every new session token with the
 * first entry and still accepts a token made with any later entry. Each request with a valid
 * session gets a fresh token, so active people move to the new secret without a sign-out.
 * Remove AUTH_SECRET_PREVIOUS after the longest session lifetime (30 days) has passed.
 *
 * NEXTAUTH_SECRET is the old Auth.js name and is read only when AUTH_SECRET is empty.
 * Edge-safe: this file reads env vars only and imports nothing.
 */

type Env = Record<string, string | undefined>;

export function authSecrets(env: Env = process.env): string[] {
  const current = env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim() || '';
  // Without a current secret, return nothing so Auth.js reports MissingSecret. A previous
  // secret alone must never become the signing secret.
  if (!current) return [];
  const previous = env.AUTH_SECRET_PREVIOUS?.trim() || '';
  return previous && previous !== current ? [current, previous] : [current];
}
