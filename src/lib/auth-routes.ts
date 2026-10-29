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
      return '/app/client/overview';
    case 'developer':
      return '/app/dev/overview';
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
    case 'developer':
      return '/app/dev/overview';
  }
}

/** Account / profile settings for the signed-in role’s shell. */
export function roleSettingsPath(role: Role): string {
  switch (role) {
    case 'super_admin':
      // The super settings page opens on the firm tab; the account row wants the profile.
      return '/app/super/settings?tab=profile';
    case 'admin':
      return '/app/admin/settings';
    case 'manager':
      return '/app/manager/settings';
    case 'intern':
      return '/app/intern/settings';
    case 'client':
      return '/app/client/settings';
    case 'developer':
      return '/app/dev/overview';
  }
}

/**
 * The profile page the account row opens (P-608, P-644, P-258). Every role has its own
 * `/app/<role>/profile` (super admin: `/app/super/profile`, developer: `/app/dev/profile`). Links that
 * point at a settings section (`#email`, `#appearance`, notification preferences, the Outlook
 * callback) keep `roleSettingsPath`.
 */
export function roleProfilePath(role: Role): string {
  if (role === 'admin' || role === 'manager' || role === 'intern') return `/app/${role}/profile`;
  if (role === 'super_admin') return '/app/super/profile';
  if (role === 'client') return '/app/client/profile';
  if (role === 'developer') return '/app/dev/profile';
  return roleSettingsPath(role);
}

/**
 * The role a `/app/<segment>/…` pathname belongs to.
 *
 * Lets shell chrome resolve role-scoped links from the URL rather than from the
 * app context, so a component can be rendered (and tested) outside a provider.
 */
export function roleFromAppPathname(pathname: string): Role | null {
  switch (pathname.split('/').filter(Boolean)[1]) {
    case 'super':
      return 'super_admin';
    case 'admin':
      return 'admin';
    case 'manager':
      return 'manager';
    case 'intern':
      return 'intern';
    case 'client':
      return 'client';
    default:
      return null;
  }
}

/** Shell base path for firm admin vs project manager. */
export type StaffBasePath = '/app/admin' | '/app/manager' | '/app/super';

export function staffBasePathForRole(role: Role | undefined): StaffBasePath {
  if (role === 'super_admin') return '/app/super';
  if (role === 'admin') return '/app/admin';
  return '/app/manager';
}
