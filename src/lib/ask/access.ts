import type { AppRole } from '@/auth/guards';
import type { AskShell } from '@/data/ask/schema';

/**
 * Who may use Ask VCFO. Managers and Project Leads never do — the gate is on the
 * real role, never on a route prefix, because admin and manager share views.
 */
export const ASK_ROLES: readonly AppRole[] = ['client', 'admin', 'super_admin'];

export class AskForbiddenError extends Error {
  constructor(message = 'Ask VCFO is not available for this role') {
    super(message);
    this.name = 'AskForbiddenError';
  }
}

export function canUseAsk(role: AppRole | string | null | undefined): boolean {
  return Boolean(role) && (ASK_ROLES as readonly string[]).includes(role as string);
}

export function assertAskRole(ctx: { role: AppRole }): void {
  if (!canUseAsk(ctx.role)) throw new AskForbiddenError();
}

/**
 * Shells a role may open. Super admin may open a client shell only as a
 * preview of one engagement (checked by the caller with an engagement id).
 */
export function shellAllowedForRole(role: AppRole, shell: AskShell): boolean {
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
export function defaultShellForRole(role: AppRole): AskShell | null {
  if (role === 'client') return 'client';
  if (role === 'admin') return 'admin';
  if (role === 'super_admin') return 'super';
  return null;
}
