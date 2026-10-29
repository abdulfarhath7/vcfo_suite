import type { AuthContext } from '@/auth/guards';

/**
 * The one access rule for every developer console repository (`dev-*.ts`, G-01): the caller
 * must be a developer or the super admin. Everyone else gets an error before any query runs.
 * These reads are firm-wide on purpose, so they mask or count anything that names a client.
 */
export function assertDeveloper(ctx: AuthContext): void {
  if (ctx.role !== 'developer' && ctx.role !== 'super_admin') {
    throw new Error('not permitted');
  }
}

/** Staff roles whose names and emails the console may list. Clients are only counted. */
export const DEV_STAFF_ROLES = ['super_admin', 'admin', 'manager', 'intern', 'developer'] as const;

export function isStaffRole(role: string): boolean {
  return (DEV_STAFF_ROLES as readonly string[]).includes(role);
}
