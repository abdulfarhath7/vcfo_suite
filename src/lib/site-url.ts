/** Canonical site origin for redirects, emails, and OG (no trailing slash). */

export function resolveSiteUrl(
  fromEnv: string | undefined,
  windowOrigin: string | undefined,
): string {
  const env = fromEnv?.trim().replace(/\/$/, '') || '';
  // Browser: always use the origin the user opened (LAN IP, rotating tunnel,
  // localhost). A baked NEXT_PUBLIC_SITE_URL for a previous trycloudflare host
  // would otherwise send fetches/links to a dead origin.
  if (windowOrigin) return windowOrigin.replace(/\/$/, '');
  if (env) return env;
  return 'http://localhost:3000';
}

function getSiteUrl(): string {
  // NEXT_PUBLIC_* is inlined at `next build`, so a container image built before
  // the public hostname exists (App Runner assigns it on first deploy) would
  // bake in localhost. SITE_URL is read at runtime on the server and wins.
  const fromEnv =
    typeof window === 'undefined'
      ? process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
      : process.env.NEXT_PUBLIC_SITE_URL;
  return resolveSiteUrl(
    fromEnv,
    typeof window === 'undefined' ? undefined : window.location.origin,
  );
}

export function loginUrl(): string {
  return `${getSiteUrl()}/login`;
}

export function resetPasswordUrl(): string {
  return `${getSiteUrl()}/auth/reset-password`;
}

export function siteUrl(): string {
  return getSiteUrl();
}
