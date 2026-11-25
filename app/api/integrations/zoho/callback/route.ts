import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/guards';
import { siteUrl } from '@/lib/site-url';
import { publicErrorMessage } from '@/lib/api-error';
import { exchangeZohoCode, parseZohoState, trustedAccountsServer } from '@/lib/integrations/zoho/oauth';
import { saveFirmConnection } from '@/db/repositories/integrations';
import { queueZohoDiscover } from '@/lib/integrations/zoho/run-discover';

const RETURN_PATH = '/app/admin/firm-settings';

/**
 * GET /api/integrations/zoho/callback — Zoho's redirect after consent. Zoho adds `location` and
 * `accounts-server`; the code is exchanged at that accounts server (Zoho hosts only), the token
 * reply's `api_domain` is kept, and discovery starts at once.
 */
export async function GET(request: Request) {
  const origin = siteUrl();
  const guard = await requireAdmin();
  if (guard.ok === false) return NextResponse.redirect(`${origin}/login?zoho=error`);

  const back = `${origin}${RETURN_PATH}`;
  const done = (query: string) => {
    const r = NextResponse.redirect(`${back}?${query}#integrations`);
    r.cookies.set('vcfo_zoho_oauth', '', { path: '/', maxAge: 0 });
    return r;
  };
  const fail = (reason: string) => done(`zoho=error&reason=${encodeURIComponent(reason.slice(0, 120))}`);

  const url = new URL(request.url);
  const err = url.searchParams.get('error');
  if (err) return fail(err);

  const code = url.searchParams.get('code')?.trim();
  const state = url.searchParams.get('state')?.trim();
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)vcfo_zoho_oauth=([^;]+)/)?.[1];
  const cookieState = cookie ? decodeURIComponent(cookie) : '';
  if (!code || !state || !cookieState || cookieState !== state || !parseZohoState(state, guard.ctx.userId)) {
    return fail('invalid_state');
  }

  let accountsServer: string;
  try {
    accountsServer = trustedAccountsServer(url.searchParams.get('accounts-server') || 'https://accounts.zoho.com');
  } catch {
    return fail('unknown_accounts_server');
  }
  const location = (url.searchParams.get('location') || 'us').trim().toLowerCase().slice(0, 8);

  try {
    const tokens = await exchangeZohoCode(code, accountsServer);
    if (!tokens.refresh_token) return fail('missing_refresh_token');
    const { id } = await saveFirmConnection(guard.ctx, {
      accountsServer,
      apiDomain: tokens.api_domain,
      location,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSec: tokens.expires_in ?? 3600,
      scopes: tokens.scope ?? null,
    });
    await queueZohoDiscover(id, guard.ctx.userId);
  } catch (e) {
    return fail(publicErrorMessage(e, 'connect_failed'));
  }
  return done('zoho=connected');
}
