/**
 * Display helpers for the two-step setup screen. No `crypto` here, so client
 * components can import it.
 */

/** The base32 key in groups of four, easier to type into an app by hand. */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}
