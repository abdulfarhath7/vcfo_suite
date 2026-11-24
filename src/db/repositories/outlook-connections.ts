import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { outlookConnections } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { decryptSecret, encryptSecret } from '@/lib/outlook/token-crypto';
import {
  graphCancelEvent,
  graphCreateTeamsEvent,
  graphGetPhoto,
  graphSendMail,
  graphSendMailWithLink,
  graphUpdateTeamsEvent,
  hasFileScope,
  refreshAccessToken,
  type GraphFileAttachment,
  type GraphTeamsEventInput,
} from '@/lib/outlook/oauth';
import { recordAuditEvent } from '@/db/repositories/audit-events';

function assertStaff(ctx: AuthContext) {
  if (ctx.role === 'client' || ctx.role === 'developer' || ctx.role === 'partner') {
    throw new Error('not permitted');
  }
}

export type OutlookConnectionPublic = {
  connected: boolean;
  msEmail?: string;
  /** K-40: add the signature below to every message sent from the app. */
  signatureEnabled: boolean;
  signatureText: string | null;
  /** The connection may read SharePoint files; false until a connection from before 24 Nov 2026 is renewed. */
  filesEnabled: boolean;
};

export async function getOutlookStatus(ctx: AuthContext): Promise<OutlookConnectionPublic> {
  assertStaff(ctx);
  const [row] = await db
    .select({
      msEmail: outlookConnections.msEmail,
      signatureEnabled: outlookConnections.signatureEnabled,
      signatureText: outlookConnections.signatureText,
      scopes: outlookConnections.scopes,
    })
    .from(outlookConnections)
    .where(eq(outlookConnections.userId, ctx.userId))
    .limit(1);
  if (!row) return { connected: false, signatureEnabled: false, signatureText: null, filesEnabled: false };
  return {
    connected: true,
    msEmail: row.msEmail,
    signatureEnabled: row.signatureEnabled,
    signatureText: row.signatureText,
    filesEnabled: hasFileScope(row.scopes),
  };
}

/**
 * Save the caller's own signature (K-40). The signature lives on the mailbox link, so a person
 * with no linked mailbox has nowhere to keep it yet and gets `outlook_not_connected`.
 */
export async function updateOutlookSignature(
  ctx: AuthContext,
  input: { signatureEnabled?: boolean; signatureText?: string | null },
): Promise<OutlookConnectionPublic> {
  assertStaff(ctx);
  const set: { signatureEnabled?: boolean; signatureText?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.signatureEnabled !== undefined) set.signatureEnabled = input.signatureEnabled;
  if (input.signatureText !== undefined) {
    set.signatureText = input.signatureText?.replace(/\r\n/g, '\n').trim().slice(0, 2000) || null;
  }
  const updated = await db
    .update(outlookConnections)
    .set(set)
    .where(eq(outlookConnections.userId, ctx.userId))
    .returning({ id: outlookConnections.id });
  if (updated.length === 0) throw new Error('outlook_not_connected');
  await recordAuditEvent(ctx, {
    action: 'outlook.signature',
    summary:
      input.signatureEnabled === false
        ? 'Email signature turned off'
        : input.signatureEnabled === true
          ? 'Email signature turned on'
          : 'Email signature changed',
  });
  return getOutlookStatus(ctx);
}

export async function upsertOutlookConnection(
  ctx: AuthContext,
  input: {
    msEmail: string;
    msUserId?: string;
    accessToken: string;
    refreshToken: string;
    expiresInSec: number;
    /** The granted scopes from the token response; left as stored when Microsoft sends none. */
    scopes?: string | null;
  },
): Promise<void> {
  assertStaff(ctx);
  const expiresAt = new Date(Date.now() + Math.max(60, input.expiresInSec) * 1000);
  const values = {
    userId: ctx.userId,
    msEmail: input.msEmail,
    msUserId: input.msUserId ?? null,
    accessTokenEnc: encryptSecret(input.accessToken),
    refreshTokenEnc: encryptSecret(input.refreshToken),
    expiresAt,
    updatedAt: new Date(),
    ...(input.scopes ? { scopes: input.scopes } : {}),
  };
  await db
    .insert(outlookConnections)
    .values(values)
    .onConflictDoUpdate({
      target: outlookConnections.userId,
      set: {
        msEmail: values.msEmail,
        msUserId: values.msUserId,
        accessTokenEnc: values.accessTokenEnc,
        refreshTokenEnc: values.refreshTokenEnc,
        expiresAt: values.expiresAt,
        updatedAt: values.updatedAt,
        ...(input.scopes ? { scopes: input.scopes } : {}),
      },
    });
}

export async function deleteOutlookConnection(ctx: AuthContext): Promise<void> {
  assertStaff(ctx);
  await db.delete(outlookConnections).where(eq(outlookConnections.userId, ctx.userId));
}

async function validAccessToken(ctx: AuthContext): Promise<{ access: string; msEmail: string }> {
  assertStaff(ctx);
  const [row] = await db
    .select()
    .from(outlookConnections)
    .where(eq(outlookConnections.userId, ctx.userId))
    .limit(1);
  if (!row) throw new Error('outlook_not_connected');

  const refresh = decryptSecret(row.refreshTokenEnc);
  const skewMs = 2 * 60 * 1000;
  if (row.expiresAt.getTime() - Date.now() > skewMs) {
    return { access: decryptSecret(row.accessTokenEnc), msEmail: row.msEmail };
  }

  const tokens = await refreshAccessToken(refresh, row.scopes);
  const nextRefresh = tokens.refresh_token ?? refresh;
  await upsertOutlookConnection(ctx, {
    msEmail: row.msEmail,
    msUserId: row.msUserId ?? undefined,
    accessToken: tokens.access_token,
    refreshToken: nextRefresh,
    expiresInSec: tokens.expires_in ?? 3600,
    // Only a connection that already records its scopes keeps them current; an older row stays
    // null, so it is still told to reconnect for SharePoint.
    scopes: row.scopes ? tokens.scope : null,
  });
  return { access: tokens.access_token, msEmail: row.msEmail };
}

export type GraphFileAccess =
  | { ok: true; access: string; msEmail: string }
  | { ok: false; code: 'not_connected' | 'reconnect' };

/**
 * A Graph token that may read SharePoint files as the caller. `not_connected` when the person has
 * no Microsoft 365 link, `reconnect` when the link predates file reading (24 Nov 2026) or its
 * refresh failed. Staff only; the token never leaves the server.
 */
export async function getGraphFileAccess(ctx: AuthContext): Promise<GraphFileAccess> {
  assertStaff(ctx);
  const [row] = await db
    .select({ scopes: outlookConnections.scopes })
    .from(outlookConnections)
    .where(eq(outlookConnections.userId, ctx.userId))
    .limit(1);
  if (!row) return { ok: false, code: 'not_connected' };
  if (!hasFileScope(row.scopes)) return { ok: false, code: 'reconnect' };
  try {
    const { access, msEmail } = await validAccessToken(ctx);
    return { ok: true, access, msEmail };
  } catch (err) {
    console.error('[outlook] token for SharePoint failed', err instanceof Error ? err.message.slice(0, 200) : err);
    return { ok: false, code: 'reconnect' };
  }
}

/** Fetch the connected mailbox’s Graph profile photo. Staff only. */
export async function fetchOwnOutlookPhoto(
  ctx: AuthContext,
): Promise<{ bytes: Buffer; contentType: string }> {
  const { access } = await validAccessToken(ctx);
  const photo = await graphGetPhoto(access);
  if (!photo) throw new Error('outlook_photo_missing');
  return photo;
}

/**
 * Checks that the caller's Outlook can send right now (linked, token fresh or refreshed), so a
 * route can answer 409 before it hands the slow send to the work after the response.
 */
export async function assertOutlookReady(ctx: AuthContext): Promise<{ msEmail: string }> {
  const { msEmail } = await validAccessToken(ctx);
  return { msEmail };
}

/** Receivables v2: the signed-in person's send that also returns the email's Outlook on the web link. */
export async function sendMailViaOutlookWithLink(ctx: AuthContext, input: { to: string[]; cc?: string[]; subject: string; html: string }): Promise<{ msEmail: string; webLink: string | null }> {
  const { access, msEmail } = await validAccessToken(ctx);
  const { webLink } = await graphSendMailWithLink(access, input);
  return { msEmail, webLink };
}

export async function sendMailViaOutlook(
  ctx: AuthContext,
  input: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    text?: string;
    attachments?: GraphFileAttachment[];
  },
): Promise<{ msEmail: string }> {
  const { access, msEmail } = await validAccessToken(ctx);
  await graphSendMail(access, input);
  return { msEmail };
}

/**
 * SYSTEM (board meetings, docs/specs/board-meetings/PLAN.md): a Teams meeting in the lead's own
 * Outlook calendar, so the notice can carry a join link. No AuthContext: the caller has already
 * checked the meeting; this only reads the named user's own connection. Without a connection or
 * without the Calendars.ReadWrite scope (connections made before 2 Nov 2026), it returns null and
 * the lead pastes a link instead.
 */
async function systemAccessToken(userId: string): Promise<string | null> {
  const [row] = await db.select().from(outlookConnections).where(eq(outlookConnections.userId, userId)).limit(1);
  if (!row) return null;
  try {
    if (row.expiresAt.getTime() - Date.now() > 2 * 60 * 1000) return decryptSecret(row.accessTokenEnc);
    const refresh = decryptSecret(row.refreshTokenEnc);
    const tokens = await refreshAccessToken(refresh, row.scopes);
    await db
      .update(outlookConnections)
      .set({
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: encryptSecret(tokens.refresh_token ?? refresh),
        expiresAt: new Date(Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000),
        updatedAt: new Date(),
        ...(row.scopes && tokens.scope ? { scopes: tokens.scope } : {}),
      })
      .where(eq(outlookConnections.userId, userId));
    return tokens.access_token;
  } catch (err) {
    console.error('[outlook] token refresh for a system call failed', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * SYSTEM (receivables reminders, docs/specs/receivables/PLAN.md): sends one message as the named
 * user from a job, using their stored connection. No AuthContext: the job has already resolved
 * the sheet's manager. Returns null without a connection, on a failed refresh or a failed send,
 * so the caller falls back to the firm's own email (SES or Resend).
 */
export async function systemSendMailAs(
  userId: string,
  input: { to: string[]; cc?: string[]; subject: string; html: string; text?: string },
): Promise<{ msEmail: string } | null> {
  const res = await systemSendMailAsResult(userId, input);
  return res.ok ? { msEmail: res.msEmail } : null;
}

/**
 * SYSTEM (receivables v2 emails): the same send as `systemSendMailAs`, with the reason when it did
 * not go, so the email log can say "connect Outlook" rather than only "failed". It never throws.
 */
export async function systemSendMailAsResult(
  userId: string,
  input: { to: string[]; cc?: string[]; subject: string; html: string; text?: string },
  opts: { withLink?: boolean } = {},
): Promise<{ ok: true; msEmail: string; webLink: string | null } | { ok: false; code: 'outlook_not_connected' | 'outlook_reconnect' | 'send_failed' }> {
  const [row] = await db.select({ msEmail: outlookConnections.msEmail }).from(outlookConnections).where(eq(outlookConnections.userId, userId)).limit(1);
  if (!row) return { ok: false, code: 'outlook_not_connected' };
  const access = await systemAccessToken(userId);
  if (!access) return { ok: false, code: 'outlook_reconnect' };
  try {
    if (opts.withLink) {
      const { webLink } = await graphSendMailWithLink(access, input);
      return { ok: true, msEmail: row.msEmail, webLink };
    }
    await graphSendMail(access, input);
    return { ok: true, msEmail: row.msEmail, webLink: null };
  } catch (err) {
    console.error('[outlook] system send failed', err instanceof Error ? err.message.slice(0, 200) : err);
    return { ok: false, code: 'send_failed' };
  }
}

export async function systemTeamsMeeting(
  userId: string,
  action: { kind: 'create'; input: GraphTeamsEventInput } | { kind: 'update'; eventId: string; input: GraphTeamsEventInput } | { kind: 'cancel'; eventId: string; comment: string },
): Promise<{ eventId: string; joinUrl: string | null } | null> {
  const access = await systemAccessToken(userId);
  if (!access) return null;
  try {
    if (action.kind === 'cancel') {
      await graphCancelEvent(access, action.eventId, action.comment);
      return { eventId: action.eventId, joinUrl: null };
    }
    if (action.kind === 'update') return await graphUpdateTeamsEvent(access, action.eventId, action.input);
    return await graphCreateTeamsEvent(access, action.input);
  } catch (err) {
    console.error('[outlook] Teams meeting call failed', err instanceof Error ? err.message : err);
    return null;
  }
}
