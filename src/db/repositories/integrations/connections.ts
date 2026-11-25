import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { integrationConnections, type IntegrationProvider } from '@/db/schema-integrations';
import type { AuthContext } from '@/auth/guards';
import { decryptSecret, encryptSecret } from '@/lib/integrations/token-crypto';
import { refreshZohoToken, revokeZohoToken } from '@/lib/integrations/zoho/oauth';
import { dcFromAccountsServer } from '@/lib/integrations/zoho/dc';
import type { ZohoConn } from '@/lib/integrations/zoho/types';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { assertFirmIntegrationAdmin } from './access';

/**
 * The firm's Zoho connection. Tokens are sealed with AUTH_SECRET (src/lib/integrations/token-crypto.ts)
 * and never leave this file in plain text except as the access token handed to a Zoho call.
 */

export type ConnectionRow = typeof integrationConnections.$inferSelect;

export interface SaveConnectionInput {
  accountsServer: string;
  apiDomain: string;
  location: string;
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  scopes: string | null;
}

/** Saves a new firm connection and retires the previous one (one live firm connection per provider). */
export async function saveFirmConnection(ctx: AuthContext, input: SaveConnectionInput, provider: IntegrationProvider = 'zoho'): Promise<{ id: string }> {
  assertFirmIntegrationAdmin(ctx);
  const now = new Date();
  const id = await db.transaction(async (tx) => {
    await tx
      .update(integrationConnections)
      .set({ status: 'revoked', revokedAt: now, updatedAt: now })
      .where(and(eq(integrationConnections.provider, provider), eq(integrationConnections.scope, 'firm'), isNull(integrationConnections.revokedAt)));
    const [row] = await tx
      .insert(integrationConnections)
      .values({
        provider,
        scope: 'firm',
        engagementId: null,
        accountsServer: input.accountsServer,
        apiDomain: input.apiDomain,
        location: input.location,
        refreshTokenEnc: encryptSecret(input.refreshToken),
        accessTokenEnc: encryptSecret(input.accessToken),
        expiresAt: new Date(now.getTime() + Math.max(60, input.expiresInSec) * 1000),
        scopes: input.scopes,
        status: 'active',
        connectedBy: ctx.userId,
        connectedAt: now,
        updatedAt: now,
      })
      .returning({ id: integrationConnections.id });
    return row!.id;
  });
  await recordAuditEvent(ctx, {
    action: 'integration.zoho.connected',
    summary: `Connected Zoho (${input.location})`,
    metadata: { connectionId: id, location: input.location, apiDomain: input.apiDomain },
  });
  return { id };
}

async function liveFirmRow(provider: IntegrationProvider): Promise<ConnectionRow | null> {
  const [row] = await db
    .select()
    .from(integrationConnections)
    .where(and(eq(integrationConnections.provider, provider), eq(integrationConnections.scope, 'firm'), isNull(integrationConnections.revokedAt)))
    .orderBy(desc(integrationConnections.connectedAt))
    .limit(1);
  return row ?? null;
}

/** The firm connection, for the hub screen. Firm-wide admins only. */
export async function getFirmConnection(ctx: AuthContext, provider: IntegrationProvider = 'zoho'): Promise<ConnectionRow | null> {
  assertFirmIntegrationAdmin(ctx);
  return liveFirmRow(provider);
}

/** Revokes the refresh token at Zoho, then retires the row (even when Zoho could not be reached). */
export async function disconnectFirmConnection(ctx: AuthContext, provider: IntegrationProvider = 'zoho'): Promise<{ revokedAtZoho: boolean }> {
  assertFirmIntegrationAdmin(ctx);
  const row = await liveFirmRow(provider);
  if (!row) return { revokedAtZoho: false };
  let revokedAtZoho: boolean;
  try {
    revokedAtZoho = (await revokeZohoToken(decryptSecret(row.refreshTokenEnc), row.accountsServer)).ok;
  } catch {
    revokedAtZoho = false;
  }
  const now = new Date();
  await db
    .update(integrationConnections)
    .set({ status: 'revoked', revokedAt: now, accessTokenEnc: null, updatedAt: now })
    .where(eq(integrationConnections.id, row.id));
  await recordAuditEvent(ctx, {
    action: 'integration.zoho.disconnected',
    summary: revokedAtZoho ? 'Disconnected Zoho and revoked the token at Zoho' : 'Disconnected Zoho (Zoho could not be reached to revoke the token)',
    metadata: { connectionId: row.id, revokedAtZoho },
  });
  return { revokedAtZoho };
}

/* ------------------------------------------------------------ system (jobs only, no session) */

/** Jobs only: the connection row by id, live or not. */
export async function systemConnectionById(id: string): Promise<ConnectionRow | null> {
  const [row] = await db.select().from(integrationConnections).where(eq(integrationConnections.id, id)).limit(1);
  return row ?? null;
}

/** Jobs only: the live firm connection. */
export async function systemFirmConnection(provider: IntegrationProvider = 'zoho'): Promise<ConnectionRow | null> {
  return liveFirmRow(provider);
}

/** A refresh this close to expiry is done before the call rather than after a 401. */
const REFRESH_MARGIN_MS = 2 * 60_000;

/**
 * Jobs only: a valid access token for the connection. Refreshes when the stored one is near expiry
 * or `force` is set, re-seals both tokens with the current AUTH_SECRET, and marks the row in
 * error when Zoho refuses the refresh token (the admin must reconnect).
 */
export async function systemAccessToken(connectionId: string, force = false, fetchImpl?: typeof fetch): Promise<string> {
  const row = await systemConnectionById(connectionId);
  if (!row || row.revokedAt) throw new Error('zoho_not_connected');
  const now = Date.now();
  if (!force && row.accessTokenEnc && row.expiresAt && row.expiresAt.getTime() - now > REFRESH_MARGIN_MS) {
    try {
      return decryptSecret(row.accessTokenEnc);
    } catch {
      // A blob from a retired AUTH_SECRET: fall through to a refresh.
    }
  }
  let refresh: string;
  try {
    refresh = decryptSecret(row.refreshTokenEnc);
  } catch {
    await markError(row.id, 'The stored Zoho token cannot be read. Reconnect Zoho.');
    throw new Error('zoho_token_unreadable');
  }
  try {
    const reply = await refreshZohoToken(refresh, row.accountsServer, fetchImpl);
    await db
      .update(integrationConnections)
      .set({
        accessTokenEnc: encryptSecret(reply.access_token),
        // Re-seal the refresh token with the current key after a rotation.
        refreshTokenEnc: encryptSecret(reply.refresh_token || refresh),
        expiresAt: new Date(now + Math.max(60, reply.expires_in ?? 3600) * 1000),
        status: 'active',
        lastError: null,
        lastUsedAt: new Date(now),
        updatedAt: new Date(now),
      })
      .where(eq(integrationConnections.id, row.id));
    return reply.access_token;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'invalid_code' || code === 'invalid_grant' || code === 'access_denied') {
      await markError(row.id, 'Zoho refused the saved sign-in. Reconnect Zoho.');
    }
    throw err;
  }
}

async function markError(id: string, message: string) {
  await db.update(integrationConnections).set({ status: 'error', lastError: message, updatedAt: new Date() }).where(eq(integrationConnections.id, id));
}

export async function systemTouchConnection(id: string): Promise<void> {
  await db.update(integrationConnections).set({ lastUsedAt: new Date() }).where(eq(integrationConnections.id, id));
}

/** Jobs only: what the Zoho readers need for this connection. */
export function connFor(row: ConnectionRow): ZohoConn {
  return {
    apiDomain: row.apiDomain,
    dc: dcFromAccountsServer(row.accountsServer) ?? 'com',
    getAccessToken: (force?: boolean) => systemAccessToken(row.id, Boolean(force)),
  };
}
