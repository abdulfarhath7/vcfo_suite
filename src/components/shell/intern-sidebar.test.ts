import { describe, expect, it } from 'vitest';
import {
  applySidebarCollapsed,
  isInternClientsListPath,
  isTypingTarget,
  parseSavedSidebarMode,
  readSavedSidebarMode,
  saveSidebarMode,
  shellDesktopNavExpanded,
  sidebarIsPinned,
  sidebarPinCopy,
  SIDEBAR_MODE_STORAGE_KEY,
  toggleSidebarPin,
} from './intern-sidebar';

describe('isInternClientsListPath', () => {
  it('matches the intern clients list, not an engagement', () => {
    expect(isInternClientsListPath('/app/intern/clients')).toBe(true);
    expect(isInternClientsListPath('/app/intern/clients/')).toBe(true);
    expect(isInternClientsListPath('/app/intern/engagements/pexpo-inc')).toBe(false);
    expect(isInternClientsListPath('/app/intern/today')).toBe(false);
  });
});

describe('shellDesktopNavExpanded', () => {
  it('keeps Keep open expanded on intern projects and the clients list', () => {
    expect(
      shellDesktopNavExpanded('open', '/app/intern/engagements/pexpo-inc', 'intern'),
    ).toBe(true);
    expect(
      shellDesktopNavExpanded(
        'open',
        '/app/intern/engagements/pexpo-inc/step/client-details',
        'intern',
      ),
    ).toBe(true);
    expect(shellDesktopNavExpanded('open', '/app/intern/clients', 'intern')).toBe(true);
  });

  it('keeps Keep closed collapsed even on the clients list', () => {
    expect(shellDesktopNavExpanded('closed', '/app/intern/clients', 'intern')).toBe(false);
    expect(
      shellDesktopNavExpanded('closed', '/app/intern/engagements/pexpo-inc', 'intern'),
    ).toBe(false);
  });

  it('expands auto only on the intern clients list (workspace width on a project)', () => {
    expect(shellDesktopNavExpanded('auto', '/app/intern/clients', 'intern')).toBe(true);
    expect(shellDesktopNavExpanded('auto', '/app/intern/clients/', 'intern')).toBe(true);
    expect(
      shellDesktopNavExpanded('auto', '/app/intern/engagements/pexpo-inc', 'intern'),
    ).toBe(false);
    expect(shellDesktopNavExpanded('auto', '/app/intern/today', 'intern')).toBe(false);
  });

  it('applies the same intern-route expand for super_admin, not other roles', () => {
    expect(shellDesktopNavExpanded('auto', '/app/intern/clients', 'super_admin')).toBe(true);
    expect(
      shellDesktopNavExpanded('open', '/app/intern/engagements/pexpo-inc', 'super_admin'),
    ).toBe(true);
    expect(shellDesktopNavExpanded('auto', '/app/intern/clients', 'manager')).toBe(false);
  });
});

describe('applySidebarCollapsed', () => {
  it('does not unpin Keep open or override Keep closed', () => {
    expect(applySidebarCollapsed('open', true)).toBe('open');
    expect(applySidebarCollapsed('open', false)).toBe('open');
    expect(applySidebarCollapsed('closed', true)).toBe('closed');
    expect(applySidebarCollapsed('closed', false)).toBe('closed');
  });

  it('lets auto collapse for workspace width and expand when requested', () => {
    expect(applySidebarCollapsed('auto', true)).toBe('auto');
    expect(applySidebarCollapsed('auto', false)).toBe('open');
  });
});

describe('toggleSidebarPin', () => {
  it('switches between pinned and the rail (R-49), and the old pinned-closed rail pins', () => {
    expect(toggleSidebarPin('open')).toBe('auto');
    expect(toggleSidebarPin('auto')).toBe('open');
    expect(toggleSidebarPin('closed')).toBe('open');
    expect(sidebarIsPinned('open')).toBe(true);
    expect(sidebarIsPinned('auto')).toBe(false);
    expect(sidebarIsPinned('closed')).toBe(false);
  });
});

describe('sidebarPinCopy', () => {
  it('names what the click does, with the "[" key', () => {
    expect(sidebarPinCopy('open')).toEqual({
      label: 'Collapse sidebar',
      hint: 'Collapse sidebar ([)',
    });
    expect(sidebarPinCopy('auto')).toEqual({
      label: 'Pin sidebar',
      hint: 'Pin sidebar ([)',
    });
    expect(sidebarPinCopy('closed')).toEqual({
      label: 'Pin sidebar',
      hint: 'Pin sidebar ([)',
    });
  });
});

describe('saved sidebar mode', () => {
  it('reads the R-49 values and the older mode names', () => {
    expect(parseSavedSidebarMode('pinned')).toBe('open');
    expect(parseSavedSidebarMode('rail')).toBe('auto');
    expect(parseSavedSidebarMode('open')).toBe('open');
    expect(parseSavedSidebarMode('auto')).toBe('auto');
    expect(parseSavedSidebarMode('closed')).toBe('auto');
    expect(parseSavedSidebarMode(null)).toBeNull();
    expect(parseSavedSidebarMode('wide')).toBeNull();
  });

  it('saves pinned or rail per browser', () => {
    window.localStorage.removeItem(SIDEBAR_MODE_STORAGE_KEY);
    expect(readSavedSidebarMode()).toBeNull();
    saveSidebarMode('auto');
    expect(window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY)).toBe('rail');
    expect(readSavedSidebarMode()).toBe('auto');
    saveSidebarMode('open');
    expect(window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY)).toBe('pinned');
    expect(readSavedSidebarMode()).toBe('open');
    window.localStorage.removeItem(SIDEBAR_MODE_STORAGE_KEY);
  });
});

describe('isTypingTarget', () => {
  it('treats fields and editable text as typing', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
