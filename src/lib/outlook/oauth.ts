import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { siteUrl } from '@/lib/site-url';
import { authSecrets } from '@/auth/secrets';
import { azureClientSecret, isInvalidClient } from '@/lib/secrets/app-secrets';
import { withSecretRetry } from '@/lib/secrets/runtime-secret';

/**
 * The scopes asked for on connect. Calendars.ReadWrite (2 Nov 2026) is for board meeting Teams
 * links. Files.Read.All and Sites.Read.All (24 Nov 2026) let Ask VCFO read a client's SharePoint
 * folder as the person, so it sees only what that person may open. Older connections lack them
 * until the person reconnects.
 */
const BASE_SCOPES = ['offline_access', 'User.Read', 'Mail.Send', 'Calendars.ReadWrite'];
const FILE_SCOPES = ['Files.Read.All', 'Sites.Read.All'];

/**
 * The file scopes are asked for only once a SharePoint site is set (SHAREPOINT_SITE_URL), so a
 * deploy before the Azure app has those permissions never puts a new consent in front of people
 * who only want email.
 */
function connectScopes(): string {
  return [...BASE_SCOPES, ...(process.env.SHAREPOINT_SITE_URL?.trim() ? FILE_SCOPES : [])].join(' ');
}

/**
 * What a connection made before 24 Nov 2026 was granted. Its refresh asks for these only, because
 * asking a refresh for a scope the person never consented to is refused by Microsoft, and that
 * would stop their email too.
 */
const LEGACY_SCOPES = BASE_SCOPES.join(' ');

/** The scope names from a token response, without the Graph prefix, for example `Files.Read.All`. */
export function grantedScopes(scope: string | null | undefined): string[] {
  if (!scope) return [];
  return [...new Set(scope.split(/\s+/).filter(Boolean).map((s) => s.replace(/^https:\/\/graph\.microsoft\.com\//i, '')))];
}

/** True when the stored scopes let the app read SharePoint files. */
export function hasFileScope(scopes: string | null | undefined): boolean {
  const names = grantedScopes(scopes).map((s) => s.toLowerCase());
  return names.includes('files.read.all') || names.includes('sites.read.all');
}

/** The scope list a refresh may ask for: what was granted, or the older list for older rows. */
function refreshScopes(stored: string | null | undefined): string {
  const names = grantedScopes(stored);
  if (names.length === 0) return LEGACY_SCOPES;
  return [...new Set(['offline_access', ...names])].join(' ');
}

function azureTenant(): string {
  return process.env.AZURE_AD_TENANT_ID?.trim() || 'common';
}

function azureClientId(): string | undefined {
  return process.env.AZURE_AD_CLIENT_ID?.trim() || undefined;
}

function outlookRedirectUri(): string {
  return `${siteUrl()}/api/outlook/callback`;
}

/**
 * The client secret is AZURE_AD_CLIENT_SECRET locally, or read at runtime from Secrets
 * Manager when AZURE_AD_CLIENT_SECRET_SECRET_ID is set (M7), so this checks presence only.
 */
export function outlookConfigured(): boolean {
  return Boolean(azureClientId() && azureClientSecret.configured());
}

/**
 * State signing keys, current first (src/auth/secrets.ts). A state is signed with
 * AUTH_SECRET and accepted with AUTH_SECRET_PREVIOUS too, so a connect flow that started
 * just before a rotation still finishes.
 */
function signingKeys(): Buffer[] {
  const secrets = authSecrets();
  if (secrets.length === 0) throw new Error('AUTH_SECRET is required for Outlook OAuth state');
  return secrets.map((secret) => createHmac('sha256', secret).update('outlook-oauth-state').digest());
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
  const sig = createHmac('sha256', signingKeys()[0]!).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseOauthState(state: string, expectedUserId: string): boolean {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return false;
  const got = Buffer.from(sig, 'base64url');
  const signed = signingKeys().some((key) => {
    const expected = createHmac('sha256', key).update(payload).digest();
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!signed) return false;
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
    scope: connectScopes(),
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
  /** The scopes Microsoft granted, space separated. */
  scope?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  return postToken({
    scope: connectScopes(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: outlookRedirectUri(),
  });
}

/** `storedScopes` is the connection's `scopes` column; null for a connection made before 24 Nov 2026. */
export async function refreshAccessToken(refreshToken: string, storedScopes?: string | null): Promise<TokenResponse> {
  return postToken({
    scope: refreshScopes(storedScopes),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

/** A refused token request; `code` is Microsoft's OAuth error code (for example invalid_client). */
class OutlookTokenError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number,
  ) {
    super(message);
    this.name = 'OutlookTokenError';
  }
}

/**
 * The token call with the current client secret. When Microsoft answers invalid_client (the
 * secret was rotated in Azure) and the secret comes from Secrets Manager, the cached value is
 * dropped and the call runs once more with the value read again (M7).
 */
async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const clientId = azureClientId();
  if (!clientId || !azureClientSecret.configured()) throw new Error('outlook_not_configured');
  return withSecretRetry(azureClientSecret, (clientSecret) => postTokenWith(clientId, clientSecret, body), isInvalidClient);
}

async function postTokenWith(clientId: string, clientSecret: string, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(
    `https://login.microsoftonline.com/${azureTenant()}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        ...body,
      }),
    },
  );
  const json = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new OutlookTokenError(json.error_description || json.error || 'token_exchange_failed', json.error, res.status);
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

/** Profile photo bytes from the signed-in Microsoft account. 404 → null (no photo). */
export async function graphGetPhoto(
  accessToken: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('graph_photo_failed');
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  return { bytes, contentType };
}

/** A file sent inline with the message (Graph `fileAttachment`, under 3 MB each). */
export type GraphFileAttachment = { name: string; contentType: string; contentBase64: string };

export async function graphSendMail(
  accessToken: string,
  input: {
    to: string[];
    cc?: string[];
    /** Hidden recipients (receivables summary, docs/specs/receivables/PLAN.md). */
    bcc?: string[];
    subject: string;
    html: string;
    text?: string;
    attachments?: GraphFileAttachment[];
  },
): Promise<void> {
  const cc = [...new Set((input.cc ?? []).map((a) => a.trim()).filter(Boolean))];
  const bcc = [...new Set((input.bcc ?? []).map((a) => a.trim()).filter(Boolean))];
  const attachments = input.attachments ?? [];
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
        ...(cc.length > 0
          ? {
              ccRecipients: cc.map((address) => ({
                emailAddress: { address },
              })),
            }
          : {}),
        ...(bcc.length > 0 ? { bccRecipients: bcc.map((address) => ({ emailAddress: { address } })) } : {}),
        ...(attachments.length > 0
          ? {
              attachments: attachments.map((a) => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: a.name,
                contentType: a.contentType,
                contentBytes: a.contentBase64,
              })),
            }
          : {}),
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 280) || `graph_send_${res.status}`);
  }
}

/**
 * Receivables v2: sends one message and returns its Outlook on the web link, for the WhatsApp
 * ping to the sender. `/me/sendMail` gives back no id, so the message is made as a draft
 * (`POST /me/messages`) and then sent (`POST /me/messages/{id}/send`). Both calls ask for
 * immutable ids (`Prefer: IdType="ImmutableId"`), so the id, and the link built on it, stay the same
 * when Outlook moves the message from Drafts to Sent Items. The link opens only in the sender's own
 * mailbox. `webLink` is null when Outlook gives none; the send itself has then still happened.
 */
export async function graphSendMailWithLink(
  accessToken: string,
  input: { to: string[]; cc?: string[]; subject: string; html: string },
): Promise<{ webLink: string | null }> {
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'IdType="ImmutableId"' };
  const cc = [...new Set((input.cc ?? []).map((a) => a.trim()).filter(Boolean))];
  const draft = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: 'HTML', content: input.html },
      toRecipients: input.to.map((address) => ({ emailAddress: { address } })),
      ...(cc.length > 0 ? { ccRecipients: cc.map((address) => ({ emailAddress: { address } })) } : {}),
    }),
  });
  if (!draft.ok) {
    const body = await draft.text();
    throw new Error(body.slice(0, 280) || `graph_draft_${draft.status}`);
  }
  const made = (await draft.json()) as { id?: string; webLink?: string };
  if (!made.id) throw new Error('graph_draft_no_id');
  const sent = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(made.id)}/send`, { method: 'POST', headers });
  if (!sent.ok) {
    const body = await sent.text();
    throw new Error(body.slice(0, 280) || `graph_send_${sent.status}`);
  }
  // The sent copy's own link, when Outlook has filed it already; otherwise the draft's, which the
  // immutable id keeps pointing at the same message.
  try {
    const after = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(made.id)}?$select=webLink`, { headers });
    if (after.ok) {
      const v = (await after.json()) as { webLink?: string };
      if (v.webLink) return { webLink: v.webLink };
    }
  } catch {
    // The email has gone; a missing link only shortens the WhatsApp ping.
  }
  return { webLink: made.webLink ?? null };
}

export interface GraphTeamsEventInput {
  subject: string;
  /** Local wall time in India, `YYYY-MM-DDTHH:MM:00`. */
  start: string;
  end: string;
  location: string;
  bodyHtml: string;
}

function teamsEventBody(input: GraphTeamsEventInput) {
  return {
    subject: input.subject,
    body: { contentType: 'HTML', content: input.bodyHtml },
    start: { dateTime: input.start, timeZone: 'India Standard Time' },
    end: { dateTime: input.end, timeZone: 'India Standard Time' },
    location: { displayName: input.location },
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
  };
}

/**
 * A Teams meeting in the signed-in user's calendar without attendees: VCFO sends its own notice
 * and invite, so Outlook must not send a second one. Needs Calendars.ReadWrite.
 */
export async function graphCreateTeamsEvent(accessToken: string, input: GraphTeamsEventInput): Promise<{ eventId: string; joinUrl: string | null }> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(teamsEventBody(input)),
  });
  if (!res.ok) throw new Error(`graph_event_create_${res.status}`);
  const j = (await res.json()) as { id: string; onlineMeeting?: { joinUrl?: string } | null };
  return { eventId: j.id, joinUrl: j.onlineMeeting?.joinUrl ?? null };
}

export async function graphUpdateTeamsEvent(accessToken: string, eventId: string, input: GraphTeamsEventInput): Promise<{ eventId: string; joinUrl: string | null }> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(teamsEventBody(input)),
  });
  if (!res.ok) throw new Error(`graph_event_update_${res.status}`);
  const j = (await res.json()) as { id: string; onlineMeeting?: { joinUrl?: string } | null };
  return { eventId: j.id, joinUrl: j.onlineMeeting?.joinUrl ?? null };
}

export async function graphCancelEvent(accessToken: string, eventId: string, comment: string): Promise<void> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`graph_event_cancel_${res.status}_${comment.length}`);
}
