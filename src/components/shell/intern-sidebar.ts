import { normalizeShellPathname } from '@/components/shell/shell-back';

/** Intern clients list — keep equal to `INTERN_CLIENTS_HREF` in InternClientsNav. */
const INTERN_CLIENTS_HREF = '/app/intern/clients';

export type SidebarMode = 'auto' | 'open' | 'closed';

export function isInternClientsListPath(pathname: string): boolean {
  return normalizeShellPathname(pathname) === INTERN_CLIENTS_HREF;
}

function internShellRole(role: string | null | undefined): boolean {
  return role === 'intern' || role === 'super_admin';
}

/**
 * Desktop rail takes content width (not hover-peek).
 * Keep open always expands; Keep closed never does; auto expands only on
 * the intern Clients list so the company list fits without rewriting the pin.
 */
export function shellDesktopNavExpanded(
  sidebarMode: SidebarMode,
  pathname: string,
  role?: string | null,
): boolean {
  if (sidebarMode === 'open') return true;
  if (sidebarMode === 'closed') return false;
  if (role != null && !internShellRole(role)) return false;
  return isInternClientsListPath(pathname);
}

/**
 * `setSidebarCollapsed` maps onto `sidebarMode`. Collapse must not unpin
 * Keep open, and neither collapse nor expand may override Keep closed.
 */
export function applySidebarCollapsed(
  current: SidebarMode,
  collapsed: boolean,
): SidebarMode {
  if (current === 'closed') return 'closed';
  if (collapsed) return current === 'open' ? 'open' : 'auto';
  return 'open';
}
