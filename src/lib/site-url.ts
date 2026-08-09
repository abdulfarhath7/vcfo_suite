/** Canonical site origin for redirects, emails, and OG (no trailing slash). */
function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');

  // In the browser, prefer the origin the user actually opened (LAN IP),
  // even if NEXT_PUBLIC_SITE_URL was baked as localhost at build/dev start.
  if (typeof window !== 'undefined') {
    const live = window.location.origin.replace(/\/$/, '');
    if (!fromEnv || isLoopbackOrigin(fromEnv) || fromEnv === live) {
      return live;
    }
  }

  if (fromEnv) return fromEnv;
  return 'http://localhost:3000';
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
