import type { AppRole } from '@/auth/guards';
import type { AssistShell } from '@/data/assist/schema';

/**
 * Who may use Assist. Managers and Project Leads never do — the gate is on the
 * real role, never on a route prefix, because admin and manager share views.
 */
export const ASSIST_ROLES: readonly AppRole[] = ['client', 'admin', 'super_admin'];

export class AssistForbiddenError extends Error {
  constructor(message = 'Assist is not available for this role') {
    super(message);
    this.name = 'AssistForbiddenError';
  }
}

export function canUseAssist(role: AppRole | string | null | undefined): boolean {
  return Boolean(role) && (ASSIST_ROLES as readonly string[]).includes(role as string);
}

export function assertAssistRole(ctx: { role: AppRole }): void {
  if (!canUseAssist(ctx.role)) throw new AssistForbiddenError();
}

/**
 * Shells a role may open. Super admin may open a client shell only as a
 * preview of one engagement (checked by the caller with an engagement id).
 */
export function shellAllowedForRole(role: AppRole, shell: AssistShell): boolean {
  switch (role) {
    case 'client':
      return shell === 'client';
    case 'admin':
      return shell === 'admin';
    case 'super_admin':
      return shell === 'super' || shell === 'client';
    default:
      return false;
  }
}

/** The shell's default for a role (launcher, first open). */
export function defaultShellForRole(role: AppRole): AssistShell | null {
  if (role === 'client') return 'client';
  if (role === 'admin') return 'admin';
  if (role === 'super_admin') return 'super';
  return null;
}
