import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { siteUrl } from '@/lib/site-url';

export const OUTLOOK_SCOPES = ['offline_access', 'User.Read', 'Mail.Send'].join(' ');

export function azureTenant(): string {
  return process.env.AZURE_AD_TENANT_ID?.trim() || 'common';
}

export function azureClientId(): string | undefined {
  return process.env.AZURE_AD_CLIENT_ID?.trim() || undefined;
}

export function azureClientSecret(): string | undefined {
  return process.env.AZURE_AD_CLIENT_SECRET?.trim() || undefined;
}

export function outlookRedirectUri(): string {
  return `${siteUrl()}/api/outlook/callback`;
}

export function outlookConfigured(): boolean {
  return Boolean(azureClientId() && azureClientSecret());
}

function signingKey(): Buffer {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error('AUTH_SECRET is required for Outlook OAuth state');
  return createHmac('sha256', secret).update('outlook-oauth-state').digest();
}

export function createOauthState(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      u: userId,
      n: randomBytes(16).toString('hex'),
      t: Date.now(),
    }),
    'utf8',
  ).toString('base64url');
  const sig = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseOauthState(state: string, expectedUserId: string): boolean {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return false;
  const expected = createHmac('sha256', signingKey()).update(payload).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return false;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      u?: string;
      t?: number;
    };
    if (json.u !== expectedUserId) return false;
    if (typeof json.t !== 'number' || Date.now() - json.t > 15 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: azureClientId() ?? '',
    response_type: 'code',
    redirect_uri: outlookRedirectUri(),
    response_mode: 'query',
    scope: OUTLOOK_SCOPES,
    state,
    prompt: 'select_account',
  });
  return `https://login.microsoftonline.com/${azureTenant()}/oauth2/v2.0/authorize?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  return postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: outlookRedirectUri(),
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return postToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const clientId = azureClientId();
  const clientSecret = azureClientSecret();
  if (!clientId || !clientSecret) throw new Error('outlook_not_configured');

  const res = await fetch(
    `https://login.microsoftonline.com/${azureTenant()}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: OUTLOOK_SCOPES,
        ...body,
      }),
    },
  );
  const json = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'token_exchange_failed');
  }
  return json;
}

export async function graphMe(accessToken: string): Promise<{ id?: string; mail?: string; userPrincipalName?: string }> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('graph_me_failed');
  return (await res.json()) as { id?: string; mail?: string; userPrincipalName?: string };
}

export async function graphSendMail(
  accessToken: string,
  input: { to: string[]; subject: string; html: string; text?: string },
): Promise<void> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: {
          contentType: 'HTML',
          content: input.html,
        },
        toRecipients: input.to.map((address) => ({
          emailAddress: { address },
        })),
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 280) || `graph_send_${res.status}`);
  }
}
