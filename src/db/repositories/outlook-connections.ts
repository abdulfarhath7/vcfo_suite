import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { outlookConnections } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { decryptSecret, encryptSecret } from '@/lib/outlook/token-crypto';
import { graphGetPhoto, graphSendMail, refreshAccessToken } from '@/lib/outlook/oauth';

function assertStaff(ctx: AuthContext) {
  if (ctx.role === 'client') {
    throw new Error('not permitted');
  }
}

export type OutlookConnectionPublic = {
  connected: boolean;
  msEmail?: string;
};

export async function getOutlookStatus(ctx: AuthContext): Promise<OutlookConnectionPublic> {
  assertStaff(ctx);
  const [row] = await db
    .select({
      msEmail: outlookConnections.msEmail,
    })
    .from(outlookConnections)
    .where(eq(outlookConnections.userId, ctx.userId))
    .limit(1);
  if (!row) return { connected: false };
  return { connected: true, msEmail: row.msEmail };
}

export async function upsertOutlookConnection(
  ctx: AuthContext,
  input: {
    msEmail: string;
    msUserId?: string;
    accessToken: string;
    refreshToken: string;
    expiresInSec: number;
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

  const tokens = await refreshAccessToken(refresh);
  const nextRefresh = tokens.refresh_token ?? refresh;
  await upsertOutlookConnection(ctx, {
    msEmail: row.msEmail,
    msUserId: row.msUserId ?? undefined,
    accessToken: tokens.access_token,
    refreshToken: nextRefresh,
    expiresInSec: tokens.expires_in ?? 3600,
  });
  return { access: tokens.access_token, msEmail: row.msEmail };
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

export async function sendMailViaOutlook(
  ctx: AuthContext,
  input: { to: string[]; cc?: string[]; subject: string; html: string; text?: string },
): Promise<{ msEmail: string }> {
  const { access, msEmail } = await validAccessToken(ctx);
  await graphSendMail(access, input);
  return { msEmail };
}
