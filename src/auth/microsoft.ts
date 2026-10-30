import MicrosoftEntraID, { type MicrosoftEntraIDProfile } from 'next-auth/providers/microsoft-entra-id';
import { entraSignInSecret } from '@/lib/secrets/app-secrets';

/**
 * MICROSOFT SIGN-IN (S-650) — the Microsoft Entra ID provider that ships with next-auth v5.
 *
 * Off unless all three env vars are set: AUTH_MICROSOFT_ENTRA_ID_ID (the app's client id),
 * AUTH_MICROSOFT_ENTRA_ID_SECRET and AUTH_MICROSOFT_ENTRA_ID_ISSUER (the firm's tenant,
 * `https://login.microsoftonline.com/<tenant id>/v2.0`). The issuer is required so a Microsoft
 * account from another organisation can never sign in; the provider's own fallback to the
 * `common` tenant is never used.
 *
 * The provider only proves who the person is. `src/auth/config.ts` then maps the Microsoft
 * identity to an EXISTING profile by email (`systemResolveExternalSignIn`); it never creates one.
 * Node-only like the rest of `config.ts`; the Edge middleware never imports this file.
 *
 * SECRET (M7): AUTH_MICROSOFT_ENTRA_ID_SECRET locally, or AUTH_MICROSOFT_ENTRA_ID_SECRET_ID
 * to read it from Secrets Manager at runtime (cached about ten minutes). `config.ts` builds
 * its config per request, so a rotated secret is used without a redeploy, and an
 * invalid_client answer drops the cache at once (`onMicrosoftSignInError`).
 */
export { MICROSOFT_PROVIDER_ID } from '@/db/repositories/sign-in-links';

export function microsoftSignInConfigured(): boolean {
  return Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() &&
      entraSignInSecret.configured() &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim(),
  );
}

/**
 * The provider list to spread into Auth.js `providers`; empty when not set up. When the
 * secret cannot be read (Secrets Manager down), Microsoft sign-in is left out for this
 * request and password sign-in keeps working.
 */
export async function microsoftProviders() {
  if (!microsoftSignInConfigured()) return [];
  let clientSecret: string | undefined;
  try {
    clientSecret = await entraSignInSecret.get();
  } catch (err) {
    console.error('[auth] Microsoft sign-in secret could not be read:', err instanceof Error ? err.name : 'error');
    return [];
  }
  if (!clientSecret) return [];
  return [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!.trim(),
      clientSecret,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!.trim(),
      // No Graph photo: the default profile() embeds it as base64, which would bloat the JWT.
      profile: (profile: MicrosoftEntraIDProfile) => ({
        id: String(profile.sub ?? ''),
        name: typeof profile.name === 'string' ? profile.name : null,
        email: microsoftEmailOf(profile as unknown as Record<string, unknown>),
        image: null,
      }),
    }),
  ];
}

/**
 * The email a Microsoft profile gives: `email` when the tenant sends it, else the sign-in name
 * (`preferred_username`, the UPN), which is the work address in a firm tenant.
 */
export function microsoftEmailOf(profile: Record<string, unknown> | null | undefined, fallback?: string | null): string | null {
  const pick = (v: unknown) => (typeof v === 'string' && v.includes('@') ? v.trim().toLowerCase() : null);
  return pick(profile?.email) ?? pick(profile?.preferred_username) ?? pick(fallback);
}

/**
 * Auth.js logs every sign-in error here. An invalid_client answer from Microsoft means the
 * client secret was rotated, so the cached value is dropped and the next sign-in reads it again.
 */
export function onMicrosoftSignInError(error: unknown): void {
  const e = error as { message?: unknown; cause?: { err?: { message?: unknown } } | unknown } | null;
  const cause = (e?.cause as { err?: { message?: unknown } } | undefined)?.err?.message;
  const text = `${String(e?.message ?? '')} ${String(cause ?? '')} ${String((e?.cause as { message?: unknown } | undefined)?.message ?? '')}`;
  if (/invalid_client|AADSTS7000215|AADSTS7000222/i.test(text)) entraSignInSecret.invalidate();
}
