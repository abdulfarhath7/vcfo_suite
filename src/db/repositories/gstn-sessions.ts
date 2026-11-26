import 'server-only';

import { and, eq, gt, isNotNull, isNull, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagements, gstnSessions } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { anyEngagement, engagementGstin, staffEngagement } from '@/db/repositories/gst-agent-scope';
import type { GstnSessionView } from '@/lib/gstzen/types';

/**
 * GSTN SESSIONS REPOSITORY — `gstn_sessions`: whether a GSTIN has an active GSTN API session at the
 * GSP (GSTZen). Status and expiry only; GSTZen holds the GSTN tokens and Suite never sees them.
 *
 * >>> ACCESS CONTROL <<<
 *   read  — staff on the engagement (admins all, a manager owned or co-managed, a lead assigned).
 *   write — `recordGstnSessionEstablished` after a consent OTP was answered: the staff member or the
 *           client of that engagement who typed it (the engagement scope decides).
 *   system — the refresh and notice jobs (`systemSessionsDueForRefresh`, `systemMarkSession*`,
 *           `systemActiveSessions`), no user.
 */

/** A session may be kept alive by refreshes for up to 30 days from consent (GSTZen docs). */
export const GSTN_SESSION_MAX_DAYS = 30;

type Row = typeof gstnSessions.$inferSelect;

export function toGstnSessionView(r: Row, now = new Date()): GstnSessionView {
  const live = r.status === 'active' && r.expiresAt && r.expiresAt.getTime() > now.getTime();
  return {
    gstin: r.gstin,
    status: live ? 'active' : r.status === 'dormant' ? 'dormant' : 'inactive',
    expiresAt: r.expiresAt?.toISOString() ?? null,
    establishedAt: r.establishedAt?.toISOString() ?? null,
    refreshedAt: r.refreshedAt?.toISOString() ?? null,
  };
}

/** The engagement's GSTIN and its session (null when none was ever established). Staff only. */
export async function getEngagementGstnSession(ctx: AuthContext, engagementId: string, now = new Date()): Promise<{ gstin: string | null; session: GstnSessionView | null; companyName: string }> {
  const { dbId, row } = await staffEngagement(ctx, engagementId);
  const gstin = await engagementGstin(dbId, row);
  if (!gstin) return { gstin: null, session: null, companyName: row.companyName };
  const [s] = await db
    .select()
    .from(gstnSessions)
    .where(and(eq(gstnSessions.gstin, gstin), eq(gstnSessions.engagementId, dbId)))
    .limit(1);
  return { gstin, session: s ? toGstnSessionView(s, now) : null, companyName: row.companyName };
}

/** Records a session GSTZen has just established after the taxpayer's consent OTP. */
export async function recordGstnSessionEstablished(
  ctx: AuthContext,
  input: { engagementId: string; gstin: string; expiresAt: Date | null },
  now = new Date(),
): Promise<GstnSessionView> {
  const { dbId } = await anyEngagement(ctx, input.engagementId);
  const values = {
    gstin: input.gstin,
    engagementId: dbId,
    status: 'active',
    expiresAt: input.expiresAt,
    establishedBy: ctx.userId,
    establishedAt: now,
    refreshedAt: null,
  };
  const [row] = await db
    .insert(gstnSessions)
    .values(values)
    .onConflictDoUpdate({ target: gstnSessions.gstin, set: { ...values, updatedAt: now } })
    .returning();
  return toGstnSessionView(row!, now);
}

/* ------------------------------------------------------------------ */
/* system (jobs)                                                       */
/* ------------------------------------------------------------------ */

/** The stored session for a GSTIN (jobs and the server-side return work). */
export async function systemGstnSession(gstin: string): Promise<Row | null> {
  const [s] = await db.select().from(gstnSessions).where(eq(gstnSessions.gstin, gstin)).limit(1);
  return s ?? null;
}

/** Active sessions that go inactive within `withinMs`, consented less than 30 days ago. */
export async function systemSessionsDueForRefresh(now: Date, withinMs: number): Promise<Row[]> {
  const limit = new Date(now.getTime() + withinMs);
  const oldest = new Date(now.getTime() - GSTN_SESSION_MAX_DAYS * 86_400_000);
  return db
    .select({ s: gstnSessions })
    .from(gstnSessions)
    .innerJoin(engagements, eq(engagements.id, gstnSessions.engagementId))
    .where(
      and(
        isNull(engagements.deletedAt),
        eq(gstnSessions.status, 'active'),
        isNotNull(gstnSessions.expiresAt),
        gt(gstnSessions.expiresAt, now),
        lte(gstnSessions.expiresAt, limit),
        gt(gstnSessions.establishedAt, oldest),
      ),
    )
    .then((rows) => rows.map((r) => r.s));
}

/** Sessions still marked active whose expiry has passed. */
export async function systemLapsedSessions(now: Date): Promise<Row[]> {
  return db
    .select()
    .from(gstnSessions)
    .where(and(eq(gstnSessions.status, 'active'), isNotNull(gstnSessions.expiresAt), lte(gstnSessions.expiresAt, now)));
}

export async function systemMarkSessionRefreshed(gstin: string, expiresAt: Date | null, now = new Date()): Promise<void> {
  await db.update(gstnSessions).set({ status: 'active', expiresAt, refreshedAt: now }).where(eq(gstnSessions.gstin, gstin));
}

export async function systemMarkSessionInactive(gstin: string): Promise<void> {
  await db.update(gstnSessions).set({ status: 'inactive' }).where(eq(gstnSessions.gstin, gstin));
}

/** GSTINs with an active session now, with their engagement (the notice watcher). */
export async function systemActiveSessions(now = new Date()): Promise<Array<{ gstin: string; engagementId: string }>> {
  const rows = await db
    .select({ gstin: gstnSessions.gstin, engagementId: gstnSessions.engagementId })
    .from(gstnSessions)
    .innerJoin(engagements, eq(engagements.id, gstnSessions.engagementId))
    .where(and(isNull(engagements.deletedAt), eq(gstnSessions.status, 'active'), gt(gstnSessions.expiresAt, now)));
  return rows;
}
