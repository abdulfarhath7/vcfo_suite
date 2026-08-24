import type { Role } from '@/lib/auth';

/** Canonical post-login destination per app role. */
export function roleHomePath(role: Role): string {
  switch (role) {
    case 'super_admin':
      return '/app/super/dashboard';
    case 'admin':
      return '/app/admin/dashboard';
    case 'manager':
      return '/app/manager/dashboard';
    case 'intern':
      return '/app/intern/today';
    case 'client':
      return '/app/client/inbox';
  }
}

/** In-app Outlook compose (staff only). */
export function roleMailPath(role: Role): string | null {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/app/admin/mail';
    case 'manager':
      return '/app/manager/mail';
    case 'intern':
      return '/app/intern/mail';
    case 'client':
      return null;
  }
}

/** Per-user notification history (dismissed + current). */
export function roleNotificationsPath(role: Role): string {
  switch (role) {
    case 'super_admin':
      return '/app/super/notifications';
    case 'admin':
      return '/app/admin/notifications';
    case 'manager':
      return '/app/manager/notifications';
    case 'intern':
      return '/app/intern/notifications';
    case 'client':
      return '/app/client/notifications';
  }
}

/** Account / profile settings for the signed-in role’s shell. */
export function roleSettingsPath(role: Role): string {
  switch (role) {
    case 'super_admin':
      return '/app/super/settings';
    case 'admin':
      return '/app/admin/settings';
    case 'manager':
      return '/app/manager/settings';
    case 'intern':
      return '/app/intern/settings';
    case 'client':
      return '/app/client/settings';
  }
}

/** Role segment index pages — same as role home. */
export function roleIndexPath(role: Role): string {
  return roleHomePath(role);
}

/** Shell base path for firm admin vs project manager. */
export type StaffBasePath = '/app/admin' | '/app/manager' | '/app/super';

export function staffBasePathForRole(role: Role | undefined): StaffBasePath {
  if (role === 'super_admin') return '/app/super';
  if (role === 'admin') return '/app/admin';
  return '/app/manager';
}
