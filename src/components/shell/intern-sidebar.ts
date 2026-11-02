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
 * True when the desktop sidebar takes its full width beside the page (not a hover peek).
 * Pinned always does; the rail does only on the intern Clients list, so the company
 * list fits without changing the saved mode. `closed` (the old pinned-closed rail) never does.
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
 * R-49: the sidebar is pinned (248px, the page beside it) or a rail (56px of icons that
 * opens the full sidebar over the page on hover or keyboard focus). `open` is pinned;
 * `auto` is the rail. `closed` was the old "pinned closed" rail with labels; it now reads
 * as the rail too, and `parseSavedSidebarMode` turns it into `auto`.
 */
export function sidebarIsPinned(mode: SidebarMode): boolean {
  return mode === 'open';
}

/** The pin button and the "[" key: pinned becomes the rail, the rail becomes pinned. */
export function toggleSidebarPin(mode: SidebarMode): SidebarMode {
  return sidebarIsPinned(mode) ? 'auto' : 'open';
}

/** The words on the pin button: what the click does, with its key. */
export function sidebarPinCopy(mode: SidebarMode): { label: string; hint: string } {
  return sidebarIsPinned(mode)
    ? { label: 'Collapse sidebar', hint: 'Collapse sidebar ([)' }
    : { label: 'Pin sidebar', hint: 'Pin sidebar ([)' };
}

/** Browser key for the kept mode. The value is `pinned` or `rail`. */
export const SIDEBAR_MODE_STORAGE_KEY = 'vcfo.sidebar';

/** Under this width the desktop sidebar is always the rail, whatever is saved. */
export const SIDEBAR_NARROW_QUERY = '(max-width: 1099px)';

/**
 * Reads a saved mode. `pinned` and `rail` are what R-49 writes; the three older names
 * (`open`, `auto`, `closed`) are accepted so a value written by an earlier build still
 * works. Anything else is `null`, which means "use the default".
 */
export function parseSavedSidebarMode(raw: string | null | undefined): SidebarMode | null {
  if (raw === 'pinned' || raw === 'open') return 'open';
  if (raw === 'rail' || raw === 'auto' || raw === 'closed') return 'auto';
  return null;
}

export function readSavedSidebarMode(): SidebarMode | null {
  try {
    return parseSavedSidebarMode(window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveSidebarMode(mode: SidebarMode): void {
  try {
    window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, sidebarIsPinned(mode) ? 'pinned' : 'rail');
  } catch {
    /* A private window or blocked storage: the mode lasts for this visit only. */
  }
}

/** True when the person is typing, so "[" stays a character. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName ?? ''));
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
