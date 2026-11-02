import 'server-only';
import { runtimeSecret } from './runtime-secret';

/**
 * The app's runtime secrets (M7). Each reads Secrets Manager when its `*_SECRET_ID` env var
 * is set (AWS) and the plain env var otherwise (local dev). See runtime-secret.ts.
 */

/** Ask VCFO: the Anthropic API key (SOC 2 exception 376, rotated by hand every 90 days). */
export const anthropicApiKey = runtimeSecret({
  envVar: 'ANTHROPIC_API_KEY',
  secretIdVar: 'ANTHROPIC_API_KEY_SECRET_ID',
  jsonKeys: ['ANTHROPIC_API_KEY', 'apiKey', 'api_key', 'key', 'value'],
});

/** Outlook mail: the Azure app client secret (SOC 2 exception 372, rotated by hand every 6 months). */
export const azureClientSecret = runtimeSecret({
  envVar: 'AZURE_AD_CLIENT_SECRET',
  secretIdVar: 'AZURE_AD_CLIENT_SECRET_SECRET_ID',
  jsonKeys: ['AZURE_AD_CLIENT_SECRET', 'clientSecret', 'client_secret', 'value'],
});

/**
 * Microsoft sign-in (S-650): the Entra app client secret. It can name the same secret as
 * AZURE_AD_CLIENT_SECRET_SECRET_ID when one Entra app serves both.
 */
export const entraSignInSecret = runtimeSecret({
  envVar: 'AUTH_MICROSOFT_ENTRA_ID_SECRET',
  secretIdVar: 'AUTH_MICROSOFT_ENTRA_ID_SECRET_ID',
  jsonKeys: ['AUTH_MICROSOFT_ENTRA_ID_SECRET', 'AZURE_AD_CLIENT_SECRET', 'clientSecret', 'client_secret', 'value'],
});

/** True for an OAuth token error that means the client secret was refused. */
export function isInvalidClient(err: unknown): boolean {
  const e = err as { code?: unknown; status?: unknown; message?: unknown } | null;
  if (!e) return false;
  if (e.code === 'invalid_client' || e.status === 401) return true;
  return typeof e.message === 'string' && /invalid_client|AADSTS7000215|AADSTS7000222/i.test(e.message);
}
