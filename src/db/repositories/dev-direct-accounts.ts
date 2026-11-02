/**
 * LOCAL DIRECT SIGN-IN (development only) — the names and roles shown on the
 * "Open as" page (app/dev-direct/route.ts). It runs before anyone is signed in,
 * so it takes no AuthContext; it is safe because it only reads the accounts
 * already listed in DEV_DIRECT_LOGIN_EMAIL (src/auth/dev-direct.ts), returns
 * no secrets, and the route is a 404 in production.
 */
import { inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles } from '@/db/schema';

export interface DevDirectAccount {
  email: string;
  name: string | null;
  role: string;
  active: boolean;
}

export async function listDevDirectAccounts(emails: string[]): Promise<DevDirectAccount[]> {
  if (!emails.length) return [];
  const rows = await db
    .select({ email: profiles.email, name: profiles.name, role: profiles.role, status: profiles.status })
    .from(profiles)
    .where(inArray(profiles.email, emails));
  return rows.map((r) => ({ email: r.email.toLowerCase(), name: r.name, role: r.role, active: r.status === 'active' }));
}
