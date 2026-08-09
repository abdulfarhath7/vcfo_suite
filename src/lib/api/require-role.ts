// Compatibility re-export. Accepts a single role or an array (legacy call sites).
import {
  requireRole as requireRoleExact,
  requireAnyRole,
  requireAuth,
  requireAdmin,
  requireManager,
  requireAdminOrManager,
  type AppRole,
  type AuthContext,
  type GuardResult,
} from '@/auth/guards';

export async function requireRole(
  roleOrRoles: AppRole | AppRole[],
): Promise<GuardResult> {
  if (Array.isArray(roleOrRoles)) {
    return requireAnyRole(...roleOrRoles);
  }
  return requireRoleExact(roleOrRoles);
}

export {
  requireAnyRole,
  requireAuth,
  requireAdmin,
  requireManager,
  requireAdminOrManager,
};
export type { AuthContext, AppRole };
