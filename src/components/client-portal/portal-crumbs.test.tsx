import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_ROUTES, isPage, routeSamples } from '@/test/page-routes';
import { PORTAL_ALIAS_KEYS, PORTAL_PATHS, PORTAL_TITLES, phaseHref, portalCrumbHref, portalTrail, type PortalCrumbInput, type PortalRouteKey } from './routes';

/* NV-03: client portal crumbs. Every crumb but the last opens a client portal page that exists. */

const nav = vi.hoisted(() => ({ pathname: '/app/client/compliances/filings' }));
const portal = vi.hoisted(() => ({ go: vi.fn(), crumbs: null as PortalCrumbInput[] | null }));

vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('./PortalProvider', () => ({
  usePortal: () => ({
    shell: null,
    go: portal.go,
    theme: 'light',
    toggleTheme: () => undefined,
    setDrawerOpen: () => undefined,
    crumbs: portal.crumbs,
  }),
}));
vi.mock('./Sidebar', () => ({
  BeforeAfterPill: () => null,
  useBreakpoint: () => 'desktop',
  useShowBeforeAfter: () => false,
}));

const { PortalTopBar } = await import('./TopBar');

const CLIENT_ROUTES = PAGE_ROUTES.filter((r) => r === '/app/client' || r.startsWith('/app/client/'));
const isClientPage = (href: string) => href.startsWith('/app/client') && isPage(href);

/** The trails the client pages set with usePortalCrumbs (labels as the pages give them). */
const PAGE_TRAILS: Array<[string, PortalCrumbInput[]]> = [
  ['/app/client/registrations/reg-1', ['Registrations', 'GST']],
  ['/app/client/compliances/obligations/ob-1', ['Compliances', 'Obligations', 'Annual return']],
  ['/app/client/compliances/obligations/meetings/m-1', ['Compliances', 'Obligations', 'Board meeting']],
  ['/app/client/compliances/obligations/tasks/t-1', ['Compliances', 'Obligations', 'Task']],
  ['/app/client/library/some-item', ['Library', 'Reading']],
  ['/app/client/incorporation/phase/1', ['Incorporation', 'Phase 1 · SPICe+ Part A']],
  ['/app/client/board-resolution', ['Incorporation', 'Board resolution (NOC)']],
  ['/app/client/incorporation/step/name-application', ['Incorporation', { label: 'SPICe+ Part A', href: phaseHref(1) }, 'Client Details']],
];

describe('portalTrail', () => {
  it.each(CLIENT_ROUTES.flatMap(routeSamples))('links every crumb but the last to a real client page on %s', (pathname) => {
    const trail = portalTrail(pathname);
    expect(trail.at(-1)?.href).toBeNull();
    for (const c of trail.slice(0, -1)) {
      expect(c.href, c.label).not.toBeNull();
      expect(isClientPage(c.href!), c.href!).toBe(true);
    }
  });

  it.each(PAGE_TRAILS)('links the trail a page sets on %s', (pathname, crumbs) => {
    const trail = portalTrail(pathname, crumbs);
    expect(trail).toHaveLength(crumbs.length);
    expect(trail.at(-1)?.href).toBeNull();
    for (const c of trail.slice(0, -1)) expect(isClientPage(c.href ?? ''), `${c.label} -> ${c.href}`).toBe(true);
  });

  it('opens SPICe+ Part A from a step page and Obligations from an obligation', () => {
    expect(portalTrail('/app/client/incorporation/step/name-application', PAGE_TRAILS[7]![1])).toEqual([
      { label: 'Incorporation', href: '/app/client/incorporation' },
      { label: 'SPICe+ Part A', href: '/app/client/incorporation/phase/1' },
      { label: 'Client Details', href: null },
    ]);
    expect(portalTrail('/app/client/compliances/obligations/ob-1', PAGE_TRAILS[1]![1]).map((c) => c.href)).toEqual([
      '/app/client/compliances/calendar',
      '/app/client/compliances/obligations',
      null,
    ]);
    expect(portalTrail('/app/client/announcements').map((c) => c.href)).toEqual(['/app/client/announcements', null]);
  });

  it('resolves every sidebar title to a real page and leaves unknown labels unlinked', () => {
    for (const key of Object.keys(PORTAL_TITLES) as PortalRouteKey[]) {
      if (PORTAL_ALIAS_KEYS.has(key)) continue;
      expect(portalCrumbHref(PORTAL_TITLES[key])).toBe(PORTAL_PATHS[key]);
      expect(isClientPage(PORTAL_PATHS[key]), PORTAL_PATHS[key]).toBe(true);
    }
    expect(portalCrumbHref('Phase 1 · SPICe+ Part A')).toBeNull();
  });
});

describe('PortalTopBar trail', () => {
  beforeEach(() => {
    portal.go.mockReset();
    portal.crumbs = null;
  });

  it('renders every crumb but the last as a link and the last as the current page', () => {
    nav.pathname = '/app/client/incorporation/step/name-application';
    portal.crumbs = PAGE_TRAILS[7]![1];
    render(<PortalTopBar onSearch={() => undefined} hasAnnouncements={false} />);
    const trail = screen.getByRole('navigation', { name: 'Location' });
    const links = within(trail).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Incorporation', '/app/client/incorporation'],
      ['SPICe+ Part A', '/app/client/incorporation/phase/1'],
    ]);
    const current = within(trail).getByText('Client Details');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.querySelector('a')).toBeNull();

    fireEvent.click(links[1]!);
    expect(portal.go).toHaveBeenCalledWith('/app/client/incorporation/phase/1');
  });

  it('leaves a modified click to the browser', () => {
    nav.pathname = '/app/client/compliances/filings';
    render(<PortalTopBar onSearch={() => undefined} hasAnnouncements={false} />);
    const link = within(screen.getByRole('navigation', { name: 'Location' })).getByRole('link', { name: 'Compliances' });
    /* jsdom cannot follow the link, so the test stops the default action itself. */
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link, { ctrlKey: true });
    expect(portal.go).not.toHaveBeenCalled();
  });
});
