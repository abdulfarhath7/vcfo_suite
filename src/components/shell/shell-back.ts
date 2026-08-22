/** Intern clients list — keep equal to `INTERN_CLIENTS_HREF` in InternClientsNav. */
const INTERN_CLIENTS_HREF = '/app/intern/clients';

/** Strip query/hash and a trailing slash (except `/`). */
export function normalizeShellPathname(pathname: string): string {
  const cut = pathname.split(/[?#]/)[0] ?? pathname;
  if (cut.length > 1 && cut.endsWith('/')) return cut.slice(0, -1);
  return cut || '/';
}

/**
 * Sidebar primary destinations (exact path, no extra segments).
 * Keep in sync with `RoleSidebar` item `to` values. Settings lives in chrome
 * (Profile / footer), not this list — nested back should show there.
 */
export const SHELL_PRIMARY_PATHS: ReadonlySet<string> = new Set([
  '/app/intern/today',
  '/app/intern/tasks',
  '/app/intern/announcements',
  INTERN_CLIENTS_HREF,
  '/app/intern/vault',
  '/app/intern/mail',
  '/app/intern/requests',
  '/app/intern/compliance',
  '/app/intern/knowledge-bank',
  '/app/intern/analytics',
  '/app/intern/audit-log',
  '/app/manager/dashboard',
  '/app/manager/announcements',
  '/app/manager/projects',
  '/app/manager/approvals',
  '/app/manager/people',
  '/app/manager/mail',
  '/app/manager/team',
  '/app/manager/compliance',
  '/app/manager/vault',
  '/app/manager/knowledge-bank',
  '/app/manager/analytics',
  '/app/manager/audit-log',
  '/app/admin/dashboard',
  '/app/admin/announcements',
  '/app/admin/projects',
  '/app/admin/people',
  '/app/admin/mail',
  '/app/admin/approvals',
  '/app/admin/compliance',
  '/app/admin/vault',
  '/app/admin/knowledge-bank',
  '/app/admin/analytics',
  '/app/admin/audit-log',
  '/app/super/dashboard',
  '/app/super/announcements',
  '/app/client/inbox',
  '/app/client/announcements',
  '/app/client/incorporation',
  '/app/client/compliances',
  '/app/client/documents',
  '/app/client/team',
  '/app/client/audit',
]);

const ROLE_INDEX_PATHS = new Set([
  '/app/intern',
  '/app/manager',
  '/app/admin',
  '/app/super',
  '/app/client',
]);

const ROLE_HOME: Record<string, string> = {
  intern: '/app/intern/today',
  manager: '/app/manager/dashboard',
  admin: '/app/admin/dashboard',
  super: '/app/super/dashboard',
  client: '/app/client/inbox',
};

function appRoleSegment(pathname: string): string | undefined {
  const parts = pathname.split('/').filter(Boolean);
  return parts[0] === 'app' ? parts[1] : undefined;
}

function roleHomeForPath(pathname: string): string {
  const role = appRoleSegment(pathname);
  return (role && ROLE_HOME[role]) || '/';
}

/** True on nested AppShell routes; false on marketing, login, and nav homes.
 *  Consumed by `PageBackButton` (page title), not the top bar. */
export function shouldShowShellBack(pathname: string): boolean {
  const path = normalizeShellPathname(pathname);
  if (!path.startsWith('/app/')) return false;
  if (ROLE_INDEX_PATHS.has(path)) return false;
  return !SHELL_PRIMARY_PATHS.has(path);
}

/**
 * Parent href when history cannot go back (new tab / length ≤ 1).
 * Engagement detail → clients list; step / board-resolution → engagement; etc.
 */
export function shellBackFallbackPath(pathname: string): string {
  const path = normalizeShellPathname(pathname);
  if (!path.startsWith('/app/')) return '/';

  const parts = path.split('/').filter(Boolean);
  const role = parts[1];
  const home = roleHomeForPath(path);

  if (path === '/app/client/board-resolution') {
    return '/app/client/incorporation';
  }

  /* /app/intern/engagements/:id → clients (there is no engagements list). */
  if (role === 'intern' && parts[2] === 'engagements' && parts.length === 4) {
    return INTERN_CLIENTS_HREF;
  }

  if (parts.length <= 2) return home;

  /* `/step/:stepId` is one nested level (engagement / project), not two. */
  const drop = parts.length >= 2 && parts[parts.length - 2] === 'step' ? 2 : 1;
  if (parts.length - drop < 2) return home;

  const parent = `/${parts.slice(0, -drop).join('/')}`;
  if (ROLE_INDEX_PATHS.has(parent)) return home;
  return parent;
}

export type ShellBackAction = { kind: 'history' } | { kind: 'href'; href: string };

export function resolveShellBackAction(
  pathname: string,
  historyLength: number,
): ShellBackAction {
  if (historyLength > 1) return { kind: 'history' };
  return { kind: 'href', href: shellBackFallbackPath(pathname) };
}
