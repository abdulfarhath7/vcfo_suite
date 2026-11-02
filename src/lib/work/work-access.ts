import { isAdminOrManager } from '@/lib/auth';

/**
 * Who may use the per-item work tools (sessions, personal checklist, time blocks,
 * date-change requests): project leads, managers, admins and super admins. Clients
 * and developers never reach a work repository.
 */
export function canUseWorkTools(role: string | null | undefined): boolean {
  return role === 'intern' || isAdminOrManager(role ?? undefined);
}

/** Only a project lead asks the manager to move a manager-set window. */
export function canRequestWindowChange(role: string | null | undefined): boolean {
  return role === 'intern';
}
