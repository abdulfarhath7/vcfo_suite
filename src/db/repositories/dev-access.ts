import 'server-only';
import { and, asc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles } from '@/db/schema';
import { userSessions } from '@/db/schema-firm';
import type { AuthContext } from '@/auth/guards';
import type { AccessPayload, StaffAccessRow } from '@/lib/dev/types';
import { DEV_STAFF_ROLES, assertDeveloper } from './dev-scope';

/**
 * DEV ACCESS — who can sign in, with what role, two-step state and open sessions (G-01).
 *
 * Access: developer or super admin only. Staff (super admin, admin, manager, project lead,
 * developer) are listed by name and email. Client accounts are never listed: they come back
 * only as counts. Password hashes and two-step secrets are never selected.
 */
export async function getAccessForDev(ctx: AuthContext): Promise<AccessPayload> {
  assertDeveloper(ctx);

  const activeSessions = db
    .select({ userId: userSessions.userId, n: sql<number>`count(*)::int`.as('n') })
    .from(userSessions)
    .where(isNull(userSessions.revokedAt))
    .groupBy(userSessions.userId)
    .as('active_sessions');

  const [staffRows, roleRows, clientRows] = await Promise.all([
    db
      .select({
        id: profiles.id,
        name: profiles.name,
        email: profiles.email,
        role: profiles.role,
        status: profiles.status,
        lastSeenAt: profiles.lastSeenAt,
        totpEnabledAt: profiles.totpEnabledAt,
        sessions: activeSessions.n,
      })
      .from(profiles)
      .leftJoin(activeSessions, eq(activeSessions.userId, profiles.id))
      .where(inArray(profiles.role, [...DEV_STAFF_ROLES]))
      .orderBy(asc(profiles.role), asc(profiles.name))
      .limit(1000),
    db
      .select({ role: profiles.role, n: sql<number>`count(*)::int` })
      .from(profiles)
      .where(eq(profiles.status, 'active'))
      .groupBy(profiles.role),
    db
      .select({
        active: sql<number>`count(*) filter (where ${profiles.status} = 'active')::int`,
        inactive: sql<number>`count(*) filter (where ${profiles.status} <> 'active')::int`,
        twoStep: sql<number>`count(*) filter (where ${profiles.totpEnabledAt} is not null)::int`,
        sessions: sql<number>`coalesce(sum(${activeSessions.n}), 0)::int`,
      })
      .from(profiles)
      .leftJoin(activeSessions, eq(activeSessions.userId, profiles.id))
      .where(eq(profiles.role, 'client')),
  ]);

  const staff: StaffAccessRow[] = staffRows.map((r) => ({
    id: r.id,
    name: r.name?.trim() || r.email.split('@')[0],
    email: r.email,
    role: r.role,
    status: r.status,
    lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
    twoStep: r.totpEnabledAt !== null,
    activeSessions: Number(r.sessions ?? 0),
  }));

  const c = clientRows[0];
  return {
    staff,
    clients: {
      active: Number(c?.active ?? 0),
      inactive: Number(c?.inactive ?? 0),
      twoStep: Number(c?.twoStep ?? 0),
      activeSessions: Number(c?.sessions ?? 0),
    },
    roles: roleRows.map((r) => ({ role: r.role, people: Number(r.n) || 0 })),
  };
}

/** Staff with at least one open session, for the overview tile. */
export async function countSignedInStaffForDev(ctx: AuthContext): Promise<number> {
  assertDeveloper(ctx);
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${userSessions.userId})::int` })
    .from(userSessions)
    .innerJoin(profiles, eq(profiles.id, userSessions.userId))
    .where(and(isNull(userSessions.revokedAt), inArray(profiles.role, [...DEV_STAFF_ROLES])));
  return Number(row?.n ?? 0);
}

/** The address domain of the seeded demo logins (`npm run db:seed`). */
export const DEMO_LOGIN_DOMAIN = 'vcfo.local';

/**
 * Seeded demo logins that can still sign in (active profiles on the demo domain), for the
 * overview's "Secrets to fix" tile and the "purge before real users" row. Counted only.
 */
export async function countDemoLoginsForDev(ctx: AuthContext): Promise<number> {
  assertDeveloper(ctx);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(and(eq(profiles.status, 'active'), ilike(profiles.email, `%@${DEMO_LOGIN_DOMAIN}`)));
  return Number(row?.n ?? 0);
}
