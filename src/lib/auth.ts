export type Role = 'super_admin' | 'admin' | 'manager' | 'intern' | 'client';
export type DbRole = Role;
export type LoginPath = 'admin' | 'manager' | 'intern' | 'client' | 'super';

/** User-facing role labels. */
export const ROLE_UI_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Project Manager',
  intern: 'Project Lead',
  client: 'Client',
};

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  /** Same-origin `/api/account/avatar?v=…` when the user has a photo. */
  imageUrl?: string | null;
  clientId?: string;
  internId?: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: DbRole;
  client_id: string | null;
  intern_id: string | null;
}

/** DB role and app role are 1:1 after the four-role split. */
export function mapDbRoleToAppRole(dbRole: DbRole): Role {
  return dbRole;
}

const DB_ROLES: readonly DbRole[] = [
  'super_admin',
  'admin',
  'manager',
  'intern',
  'client',
];

export function isValidDbRole(role: string): role is DbRole {
  return (DB_ROLES as readonly string[]).includes(role);
}

export function profileToAuthUser(profile: Profile): AuthUser {
  const role = mapDbRoleToAppRole(profile.role);
  return {
    id: profile.id,
    name: profile.name || profile.email.split('@')[0],
    email: profile.email,
    role,
    initials: initialsFromName(profile.name || profile.email),
    clientId: profile.client_id ?? undefined,
    internId: profile.intern_id ?? undefined,
  };
}

export function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Firm-wide admins (super admin + firm admin). */
export function isFirmWideAdmin(role: Role | string | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
}

/** Firm admin or project manager (shared create/approve surfaces). */
export function isAdminOrManager(role: Role | string | undefined): boolean {
  return isFirmWideAdmin(role) || role === 'manager';
}

/** Super admin may enter any role shell for bird's-eye review. */
export function canEnterRoleShell(
  userRole: Role | string | undefined,
  required: Role | string,
): boolean {
  if (!userRole) return false;
  if (userRole === required) return true;
  if (userRole === 'super_admin') return true;
  return false;
}
