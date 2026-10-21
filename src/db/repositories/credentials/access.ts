import 'server-only';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { credentialAccessGrants, engagementCredentials } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import {
  assertEngagementAccess,
  getMyEngagement,
  type EngagementDbRow,
} from '@/db/repositories/engagements';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import {
  KYC_ROWS,
  SHEET_COLS,
  scopesCovering,
  type CredMode,
  type CredSheet,
} from '@/lib/client-portal/credentials';

/**
 * CREDENTIALS REPOSITORY — the client's government-portal logins, registrations,
 * addresses and directors' KYC (prototype v7p_credentials) + the PAN / TAN
 * password reveal (v7p_ids_password).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   client  — only the engagement `getMyEngagement(ctx)` resolves to (own /
 *             engagement_clients member), re-checked with
 *             `assertEngagementAccess`. A client NEVER receives a secret value
 *             unless it holds a live grant (manager-approved OTP, 10 minutes)
 *             on a scope covering that cell, and may only write inside a live
 *             Edit grant. OTPs / grants are keyed by `ctx.userId`; another
 *             person's grant never unlocks anything.
 *   manager / intern (lead) — engagements `assertEngagementAccess` allows
 *             (owned / engagement_managers / engagement_leads); they read and
 *             write without an OTP (they are the approvers).
 *   admin / super_admin — firm-wide, same as staff.
 * Every OTP request, grant, reveal, edit, undo, row change and lock writes an
 * audit event (`credentials.*`, `identifiers.reveal`) — the Access log drawer
 * and the Audit page both read audit_events.
 */

export class CredentialsError extends Error {
  constructor(
    public code: string,
    public status: number,
    public extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

export const SESSION_MS = 10 * 60_000;
export const OTP_TTL_MS = 10 * 60_000;
export const RESEND_MS = 30_000;
export const LOCK_MS = 60_000;
export const MAX_TRIES = 3;
/** New OTP codes one person may ask for per engagement per hour (security review H2). */
export const OTP_REQUESTS_PER_HOUR = 6;
export const SHEETS: CredSheet[] = ['address', 'login', 'reg', 'kyc', 'other'];

export type Access = { dbId: string; row: EngagementDbRow; staff: boolean };

export async function resolveAccess(ctx: AuthContext, engagementId?: string | null): Promise<Access> {
  if (ctx.role === 'client') {
    const mine = await getMyEngagement(ctx);
    if (!mine) throw new CredentialsError('not_found', 404);
    if (engagementId && engagementId !== mine.id && engagementId !== appEngagementId(mine.id)) {
      // A client may only ever address its own engagement.
      const other = await assertEngagementAccess(ctx, engagementId);
      if (!other.ok) throw new CredentialsError('forbidden', 403);
      return { dbId: other.dbId, row: other.row, staff: false };
    }
    const a = await assertEngagementAccess(ctx, mine.id);
    if (!a.ok) throw new CredentialsError('forbidden', 403);
    return { dbId: a.dbId, row: a.row, staff: false };
  }
  if (!engagementId) throw new CredentialsError('engagement_required', 400);
  const a = await assertEngagementAccess(ctx, engagementId);
  if (!a.ok) throw new CredentialsError('notFound' in a ? 'not_found' : 'forbidden', 'notFound' in a ? 404 : 403);
  return { dbId: a.dbId, row: a.row, staff: true };
}

/* ------------------------------------------------------------------ */
/* stored rows                                                         */
/* ------------------------------------------------------------------ */

export type StoredRow = typeof engagementCredentials.$inferSelect;
export const aadOf = (dbId: string, sheet: string, rowKey: string) => `${dbId}|${sheet}|${rowKey}`;

export async function loadStored(dbId: string): Promise<StoredRow[]> {
  return db.select().from(engagementCredentials).where(eq(engagementCredentials.engagementId, dbId));
}

export function isSecretCell(sheet: CredSheet, rowKey: string, colKey: string): boolean {
  if (sheet === 'kyc') return Boolean(KYC_ROWS.find((p) => p.key === rowKey)?.s);
  return Boolean(SHEET_COLS[sheet].find((c) => c.key === colKey)?.s);
}

interface Live {
  scope: string;
  mode: CredMode;
  expiresAt: Date;
  id: string;
}

export async function liveGrants(ctx: AuthContext, dbId: string): Promise<Live[]> {
  const rows = await db
    .select()
    .from(credentialAccessGrants)
    .where(
      and(
        eq(credentialAccessGrants.engagementId, dbId),
        eq(credentialAccessGrants.profileId, ctx.userId),
        gt(credentialAccessGrants.expiresAt, new Date()),
        isNull(credentialAccessGrants.revokedAt),
      ),
    );
  return rows.map((r) => ({ id: r.id, scope: r.scope, mode: r.mode as CredMode, expiresAt: r.expiresAt }));
}

export function canSee(grants: Live[], key: string): boolean {
  const s = scopesCovering(key);
  return grants.some((g) => s.includes(g.scope));
}
export function canEdit(grants: Live[], key: string): boolean {
  const s = scopesCovering(key).filter((x) => !x.startsWith('cell:'));
  return grants.some((g) => g.mode === 'edit' && s.includes(g.scope));
}
