import 'server-only';
import { auth } from './config';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles } from '@/db/schema';
import { isFirmWideAdmin, isValidDbRole } from '@/lib/auth';

/**
 * Role guards for API routes and server actions.
 *
 * Roles (DB + session):
 *   - super_admin = bird's-eye (firm + client)
 *   - admin       = firm Admin (all engagements)
 *   - manager     = Project Manager (scoped by engagements.manager_id)
 *   - intern      = Project Lead
 *   - client      = client portal user
 *
 * Tenant scoping lives in repositories (Path A), not RLS.
 *
 * Role/scoping ids are re-read from `profiles` on each request so a stale JWT
 * (or Auth.js dropping custom credential fields) cannot block client submits.
 */

export type AppRole = 'super_admin' | 'admin' | 'manager' | 'intern' | 'client';

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  role: AppRole;
  /** Scoping key for interns (was my_intern_id() in RLS). */
  internId?: string;
  /** Scoping key for clients (was my_client_id() in RLS). */
  clientId?: string;
}

type Ok = { ok: true; ctx: AuthContext };
type Err = { ok: false; status: 401 | 403; error: string };
export type GuardResult = Ok | Err;

async function currentContext(): Promise<AuthContext | null> {
  const session = await auth();
  const u = session?.user as
    | {
        id?: string;
        email?: string;
        name?: string;
        role?: string;
        internId?: string;
        clientId?: string;
      }
    | undefined;
  if (!u?.id) return null;

  // Prefer live profile row over JWT custom claims (source of truth).
  const [row] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      name: profiles.name,
      role: profiles.role,
      internId: profiles.internId,
      clientId: profiles.clientId,
      status: profiles.status,
    })
    .from(profiles)
    .where(eq(profiles.id, u.id))
    .limit(1);

  if (!row || row.status !== 'active') return null;
  if (!isValidDbRole(row.role)) return null;
  if (row.role === 'intern' && !row.internId?.trim()) return null;

  return {
    userId: row.id,
    email: row.email ?? u.email ?? '',
    name: row.name?.trim() || u.name || row.email.split('@')[0] || 'User',
    role: row.role,
    internId: row.internId ?? undefined,
    clientId: row.clientId ?? undefined,
  };
}

/** Any authenticated user. */
export async function requireAuth(): Promise<GuardResult> {
  const ctx = await currentContext();
  if (!ctx) return { ok: false, status: 401, error: 'Not authenticated' };
  return { ok: true, ctx };
}

/** Require a specific role. */
export async function requireRole(role: AppRole): Promise<GuardResult> {
  const ctx = await currentContext();
  if (!ctx) return { ok: false, status: 401, error: 'Not authenticated' };
  if (ctx.role !== role && !(role === 'admin' && ctx.role === 'super_admin')) {
    return { ok: false, status: 403, error: `Requires ${role} role` };
  }
  return { ok: true, ctx };
}

/** Firm Admin or Super Admin. */
export async function requireAdmin(): Promise<GuardResult> {
  const ctx = await currentContext();
  if (!ctx) return { ok: false, status: 401, error: 'Not authenticated' };
  if (!isFirmWideAdmin(ctx.role)) {
    return { ok: false, status: 403, error: 'Requires admin role' };
  }
  return { ok: true, ctx };
}

/** Project Manager only. */
export async function requireManager(): Promise<GuardResult> {
  return requireRole('manager');
}

/** Firm Admin, Super Admin, or Project Manager. */
export async function requireAdminOrManager(): Promise<GuardResult> {
  return requireAnyRole('super_admin', 'admin', 'manager');
}

/** Super Admin only. */
export async function requireSuperAdmin(): Promise<GuardResult> {
  return requireRole('super_admin');
}

/** One of several roles. */
export async function requireAnyRole(...roles: AppRole[]): Promise<GuardResult> {
  const ctx = await currentContext();
  if (!ctx) return { ok: false, status: 401, error: 'Not authenticated' };
  if (!roles.includes(ctx.role)) {
    return { ok: false, status: 403, error: `Requires one of: ${roles.join(', ')}` };
  }
  return { ok: true, ctx };
}
