import { describe, expect, it } from 'vitest';
import {
  applySidebarCollapsed,
  cycleSidebarMode,
  isInternClientsListPath,
  shellDesktopNavExpanded,
  sidebarPinCopy,
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

describe('cycleSidebarMode', () => {
  it('cycles Auto → pin open → pin closed → Auto', () => {
    expect(cycleSidebarMode('auto')).toBe('open');
    expect(cycleSidebarMode('open')).toBe('closed');
    expect(cycleSidebarMode('closed')).toBe('auto');
  });
});

describe('sidebarPinCopy', () => {
  it('names the current pin and the next click', () => {
    expect(sidebarPinCopy('auto')).toEqual({
      label: 'Auto',
      hint: 'Auto (hover). Click to pin open',
    });
    expect(sidebarPinCopy('open')).toEqual({
      label: 'Pin',
      hint: 'Pinned open. Click to pin closed',
    });
    expect(sidebarPinCopy('closed')).toEqual({
      label: 'Closed',
      hint: 'Pinned closed. Click for auto (hover)',
    });
  });
});
