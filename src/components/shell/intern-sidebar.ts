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

/** Footer pin: Auto (hover) → pin open → pin closed → Auto. */
export function cycleSidebarMode(mode: SidebarMode): SidebarMode {
  if (mode === 'auto') return 'open';
  if (mode === 'open') return 'closed';
  return 'auto';
}

/** Short label plus tooltip/aria that names the current pin and the next click. */
export function sidebarPinCopy(mode: SidebarMode): { label: string; hint: string } {
  switch (mode) {
    case 'open':
      return { label: 'Pin', hint: 'Pinned open. Click to pin closed' };
    case 'closed':
      return { label: 'Closed', hint: 'Pinned closed. Click for auto (hover)' };
    default:
      return { label: 'Auto', hint: 'Auto (hover). Click to pin open' };
  }
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
