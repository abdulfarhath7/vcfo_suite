import MicrosoftEntraID, { type MicrosoftEntraIDProfile } from 'next-auth/providers/microsoft-entra-id';

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
 */
export { MICROSOFT_PROVIDER_ID } from '@/db/repositories/sign-in-links';

export function microsoftSignInConfigured(): boolean {
  return Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim() &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim(),
  );
}

/** The provider list to spread into Auth.js `providers`; empty when not set up. */
export function microsoftProviders() {
  if (!microsoftSignInConfigured()) return [];
  return [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!.trim(),
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!.trim(),
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
