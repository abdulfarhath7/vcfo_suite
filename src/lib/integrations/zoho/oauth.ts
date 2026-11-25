import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { siteUrl } from '@/lib/site-url';
import { authSecrets } from '@/auth/secrets';
import { zohoClientSecret } from '@/lib/secrets/app-secrets';
import { withSecretRetry } from '@/lib/secrets/runtime-secret';
import { accountsDomain, dcFromAccountsServer, isKnownApiDomain } from './dc';
import type { ZohoApp } from '@/db/schema-integrations';

/**
 * Zoho OAuth for the firm connection (docs/specs/integrations/ZOHO.md). One consent asks the read
 * scopes of every app below. The person signs in at accounts.zoho.com; Zoho sends them to their
 * own datacenter and puts `location` and `accounts-server` on the callback. The code is exchanged
 * at that accounts server (only one of Zoho's own hosts is accepted) and the reply carries
 * `api_domain`; all three are stored on the connection.
 */

/**
 * Read scopes per app. Names come from Zoho's official OpenAPI documents (Books, Payroll) and the
 * scope families in @wanasapps/zoho-api's registry (People's prefix is upper case).
 */
export const ZOHO_READ_SCOPES: Record<ZohoApp, string[]> = {
  books: ['ZohoBooks.settings.READ', 'ZohoBooks.contacts.READ', 'ZohoBooks.invoices.READ', 'ZohoBooks.customerpayments.READ'],
  invoice: ['ZohoInvoice.settings.READ', 'ZohoInvoice.contacts.READ', 'ZohoInvoice.invoices.READ', 'ZohoInvoice.customerpayments.READ'],
  crm: ['ZohoCRM.org.READ', 'ZohoCRM.modules.accounts.READ', 'ZohoCRM.settings.fields.READ'],
  payroll: ['ZohoPayroll.settings.READ', 'ZohoPayroll.employee.READ', 'ZohoPayroll.payrollrun.READ', 'ZohoPayroll.salary.READ'],
  people: ['ZOHOPEOPLE.forms.READ', 'ZOHOPEOPLE.employee.READ', 'ZOHOPEOPLE.attendance.READ', 'ZOHOPEOPLE.leave.READ'],
};

export const ZOHO_APPS: ZohoApp[] = ['books', 'invoice', 'crm', 'payroll', 'people'];

/**
 * The apps asked for at consent. All five by default; `ZOHO_APPS=books,crm` narrows the list when
 * Zoho refuses a scope for a product the account does not have.
 */
export function consentApps(env: Record<string, string | undefined> = process.env): ZohoApp[] {
  const raw = env.ZOHO_APPS?.trim();
  if (!raw) return ZOHO_APPS;
  const want = new Set(raw.split(/[\s,]+/).map((s) => s.toLowerCase()));
  const picked = ZOHO_APPS.filter((a) => want.has(a));
  return picked.length ? picked : ZOHO_APPS;
}

export function connectScopes(apps: ZohoApp[] = consentApps()): string {
  return apps.flatMap((a) => ZOHO_READ_SCOPES[a]).join(',');
}

/** Which apps a stored scope string covers (Zoho answers with the granted scopes, comma or space separated). */
export function appsInScopes(scopes: string | null | undefined): ZohoApp[] {
  const have = new Set((scopes ?? '').split(/[\s,]+/).filter(Boolean).map((s) => s.toLowerCase()));
  if (have.size === 0) return [];
  return ZOHO_APPS.filter((a) => ZOHO_READ_SCOPES[a].some((s) => have.has(s.toLowerCase())));
}

function zohoClientId(): string | undefined {
  return process.env.ZOHO_CLIENT_ID?.trim() || undefined;
}

export function zohoRedirectUri(): string {
  return `${siteUrl()}/api/integrations/zoho/callback`;
}

export function zohoConfigured(): boolean {
  return Boolean(zohoClientId() && zohoClientSecret.configured());
}

/* ------------------------------------------------------------------ state */

function signingKeys(): Buffer[] {
  const secrets = authSecrets();
  if (secrets.length === 0) throw new Error('AUTH_SECRET is required for Zoho OAuth state');
  return secrets.map((secret) => createHmac('sha256', secret).update('zoho-oauth-state').digest());
}

export function createZohoState(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, n: randomBytes(16).toString('hex'), t: now }), 'utf8').toString('base64url');
  const sig = createHmac('sha256', signingKeys()[0]!).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseZohoState(state: string, expectedUserId: string, now = Date.now()): boolean {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return false;
  const got = Buffer.from(sig, 'base64url');
  const signed = signingKeys().some((key) => {
    const expected = createHmac('sha256', key).update(payload).digest();
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!signed) return false;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { u?: string; t?: number };
    if (json.u !== expectedUserId) return false;
    return typeof json.t === 'number' && now - json.t <= 15 * 60 * 1000;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ calls */

/** The consent page always starts at accounts.zoho.com; Zoho redirects to the person's datacenter. */
export function zohoAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    scope: connectScopes(),
    client_id: zohoClientId() ?? '',
    response_type: 'code',
    access_type: 'offline',
    // `consent` makes Zoho issue a refresh token on every connect, not only the first.
    prompt: 'consent',
    redirect_uri: zohoRedirectUri(),
    state,
  });
  return `${accountsDomain('com')}/oauth/v2/auth?${params.toString()}`;
}

export type ZohoTokenReply = {
  access_token: string;
  refresh_token?: string;
  api_domain?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

/** A refused token call; `code` is Zoho's error (invalid_code, invalid_client …). */
export class ZohoTokenError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ZohoTokenError';
  }
}

function isZohoInvalidClient(err: unknown): boolean {
  return err instanceof ZohoTokenError && (err.code === 'invalid_client' || err.code === 'invalid_client_secret');
}

/** Normalised accounts server or a thrown error when it is not one of Zoho's hosts. */
export function trustedAccountsServer(server: string | null | undefined): string {
  const dc = dcFromAccountsServer(server);
  if (!dc) throw new ZohoTokenError('unknown_accounts_server', 'unknown_accounts_server', 400);
  return accountsDomain(dc);
}

async function postToken(accountsServer: string, body: Record<string, string>, fetchImpl: typeof fetch = fetch): Promise<ZohoTokenReply> {
  const clientId = zohoClientId();
  if (!clientId || !zohoClientSecret.configured()) throw new Error('zoho_not_configured');
  const host = trustedAccountsServer(accountsServer);
  return withSecretRetry(
    zohoClientSecret,
    async (secret) => {
      const res = await fetchImpl(`${host}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: secret, ...body }),
      });
      const json = (await res.json().catch(() => ({}))) as ZohoTokenReply & { error?: string };
      // Zoho answers 200 with `{ error }` for a refused code or client.
      if (!res.ok || json.error || !json.access_token) {
        throw new ZohoTokenError(json.error || `token_${res.status}`, json.error, res.status);
      }
      return json;
    },
    isZohoInvalidClient,
  );
}

export async function exchangeZohoCode(code: string, accountsServer: string, fetchImpl?: typeof fetch): Promise<ZohoTokenReply & { api_domain: string }> {
  const reply = await postToken(accountsServer, { grant_type: 'authorization_code', code, redirect_uri: zohoRedirectUri() }, fetchImpl);
  if (!reply.api_domain || !isKnownApiDomain(reply.api_domain)) {
    throw new ZohoTokenError('unknown_api_domain', 'unknown_api_domain', 400);
  }
  return reply as ZohoTokenReply & { api_domain: string };
}

export async function refreshZohoToken(refreshToken: string, accountsServer: string, fetchImpl?: typeof fetch): Promise<ZohoTokenReply> {
  return postToken(accountsServer, { grant_type: 'refresh_token', refresh_token: refreshToken }, fetchImpl);
}

/** Revokes the refresh token at Zoho. A failure is returned, not thrown: the local row is revoked regardless. */
export async function revokeZohoToken(refreshToken: string, accountsServer: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  try {
    const host = trustedAccountsServer(accountsServer);
    const res = await fetchImpl(`${host}/oauth/v2/token/revoke?${new URLSearchParams({ token: refreshToken }).toString()}`, { method: 'POST' });
    return res.ok ? { ok: true } : { ok: false, error: `revoke_${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'revoke_failed' };
  }
}
