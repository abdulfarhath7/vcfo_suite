import 'server-only';

/**
 * Deploy-time configuration of the two card agent routes. Both are OFF unless configured, and
 * the admin switch (Settings > Agents) must also be on (`routeOpenFor` in `settings.ts`).
 *
 * Live browser (docs/specs/live-portal-browser/PLAN.md):
 *   LIVE_BROWSER_URL            the broker's internal URL, for example http://live-browser.internal:8080
 *   LIVE_BROWSER_PUBLIC_URL     the stream's public base, for example wss://live.sbctrack.in
 *   LIVE_BROWSER_SHARED_SECRET  HMAC key shared by Suite and the broker (Secrets Manager)
 *
 * GSTZen (docs/specs/live-portal-browser/GSTZEN.md):
 *   GSTZEN_BASE_URL             default https://my.gstzen.in
 *   GSTZEN_USERNAME             the firm's GSTZen login (not a GST portal login)
 *   GSTZEN_PASSWORD             secret (Secrets Manager)
 *   GSTZEN_API_TOKEN            secret: the GSTZen API key for the validator APIs
 */

type Env = Record<string, string | undefined>;

const set = (v: string | undefined) => Boolean(v && v.trim());

export function browserConfigured(env: Env = process.env): boolean {
  return set(env.LIVE_BROWSER_URL) && set(env.LIVE_BROWSER_PUBLIC_URL) && set(env.LIVE_BROWSER_SHARED_SECRET);
}

export function gstzenConfigured(env: Env = process.env): boolean {
  return set(env.GSTZEN_USERNAME) && set(env.GSTZEN_PASSWORD);
}

export function gstzenBaseUrl(env: Env = process.env): string {
  return (env.GSTZEN_BASE_URL?.trim() || 'https://my.gstzen.in').replace(/\/+$/, '');
}
