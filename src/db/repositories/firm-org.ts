import 'server-only';

import bcrypt from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { recordAuditEvent } from '@/db/repositories/audit-events';

/**
 * FIRM ORG REPOSITORY (G-20) — who a project manager reports to, and developer accounts.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   listReportingLines / setManagerAdmin — firm-wide admins only (super admin, admin), like the
 *       People roster (`listStaffPeople`) these lines sit beside.
 *   createDeveloperProfile — the super admin only. A developer reaches nothing but the
 *       developer console (`requireDeveloper` in `src/auth/guards.ts`).
 *
 * Every change writes an audit event (R-40).
 */

export class FirmOrgForbiddenError extends Error {
  constructor(message = 'Not permitted') {
    super(message);
    this.name = 'FirmOrgForbiddenError';
  }
}

export interface ReportingLine {
  managerId: string;
  /** The firm admin (or super admin) the manager reports to; null when not set. */
  adminId: string | null;
}

/** Every project manager and the admin they report to. */
export async function listReportingLines(ctx: AuthContext): Promise<ReportingLine[]> {
  if (!isFirmWideAdmin(ctx.role)) throw new FirmOrgForbiddenError('Only firm admins may read reporting lines');
  const rows = await db
    .select({ id: profiles.id, adminId: profiles.reportsToAdminId })
    .from(profiles)
    .where(eq(profiles.role, 'manager'));
  return rows.map((r) => ({ managerId: r.id, adminId: r.adminId ?? null }));
}

/** Set (or clear) the admin a project manager reports to. */
export async function setManagerAdmin(
  ctx: AuthContext,
  managerId: string,
  adminId: string | null,
): Promise<ReportingLine> {
  if (!isFirmWideAdmin(ctx.role)) throw new FirmOrgForbiddenError('Only firm admins may change reporting lines');

  const ids = adminId ? [managerId, adminId] : [managerId];
  const people = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      email: profiles.email,
      role: profiles.role,
      reportsToAdminId: profiles.reportsToAdminId,
    })
    .from(profiles)
    .where(inArray(profiles.id, ids));

  const manager = people.find((p) => p.id === managerId);
  if (!manager || manager.role !== 'manager') throw new Error('manager_not_found');
  const admin = adminId ? people.find((p) => p.id === adminId) : null;
  if (adminId && (!admin || !isFirmWideAdmin(admin.role))) throw new Error('admin_not_found');

  const previous = manager.reportsToAdminId ?? null;
  if (previous === adminId) return { managerId, adminId };

  await db
    .update(profiles)
    .set({ reportsToAdminId: adminId, updatedAt: new Date() })
    .where(eq(profiles.id, managerId));

  const managerName = manager.name?.trim() || manager.email;
  const adminName = admin ? admin.name?.trim() || admin.email : null;
  await recordAuditEvent(ctx, {
    action: 'manager.reports_to_admin',
    summary: adminName
      ? `${managerName} now reports to ${adminName}`
      : `${managerName} no longer reports to an admin`,
    metadata: { managerId, old: previous, new: adminId },
  });

  return { managerId, adminId };
}

/** Super admin: create a developer account (developer console only). */
export async function createDeveloperProfile(
  ctx: AuthContext,
  input: { email: string; password: string; fullName?: string },
): Promise<{ userId: string; name: string; email: string }> {
  if (ctx.role !== 'super_admin') {
    throw new FirmOrgForbiddenError('Only the super admin may create developer accounts');
  }
  const email = input.email.trim().toLowerCase();
  const name = input.fullName?.trim() || email.split('@')[0] || 'Developer';

  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);
  if (existing) throw new Error('email_already_registered');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const [row] = await db
    .insert(profiles)
    .values({ email, passwordHash, name, role: 'developer', status: 'active' })
    .returning({ id: profiles.id, email: profiles.email, name: profiles.name });

  await recordAuditEvent(ctx, {
    action: 'developer.create',
    summary: `Created developer ${row.name ?? name}`,
    metadata: { email: row.email },
  });

  return { userId: row.id, name: row.name ?? name, email: row.email };
}
