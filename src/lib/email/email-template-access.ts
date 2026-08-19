import { isFirmWideAdmin } from '@/lib/auth';

/** Staff compose templates are firm-scoped. Clients have no access. */
export function canAccessEmailTemplates(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'manager' || role === 'intern';
}

export function canCreateEmailTemplate(role: string | undefined): boolean {
  return canAccessEmailTemplates(role);
}

/** Admin/manager: any firm template. Intern: own rows only. */
export function canMutateEmailTemplate(
  ctx: { role: string; userId: string },
  createdBy: string,
): boolean {
  if (!canAccessEmailTemplates(ctx.role)) return false;
  if (isFirmWideAdmin(ctx.role) || ctx.role === 'manager') return true;
  return createdBy === ctx.userId;
}
