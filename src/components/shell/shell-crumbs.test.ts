import { describe, expect, it } from 'vitest';
import {
  resolveShellCrumbCurrent,
  shellBreadcrumb,
  shellCrumbParent,
} from './shell-crumbs';

describe('shellBreadcrumb', () => {
  it('nests announcements and notifications under Updates without a fake href', () => {
    expect(shellBreadcrumb('/app/intern/announcements')).toEqual({
      parent: 'Updates',
      parentHref: null,
      current: 'Announcements',
      icon: 'megaphone',
    });
    expect(shellBreadcrumb('/app/manager/notifications')).toEqual({
      parent: 'Updates',
      parentHref: null,
      current: 'Notifications',
      icon: 'bell',
    });
  });

  it('nests vault and knowledge bank under Docs without a /docs route', () => {
    expect(shellBreadcrumb('/app/intern/vault')).toEqual({
      parent: 'Docs',
      parentHref: null,
      current: 'Vault',
      icon: 'folder',
    });
    expect(shellCrumbParent('knowledge-bank')).toBe('Docs');
    expect(shellBreadcrumb('/app/manager/knowledge-bank')).toMatchObject({
      parent: 'Docs',
      parentHref: null,
      current: 'Knowledge Bank',
      icon: 'folder',
    });
  });

  it('links client board resolution under Incorporation', () => {
    expect(shellBreadcrumb('/app/client/board-resolution')).toEqual({
      parent: 'Incorporation',
      parentHref: '/app/client/incorporation',
      current: 'Board Resolution',
      icon: 'briefcase',
    });
  });

  it('uses the page name alone on top-level homes', () => {
    expect(shellBreadcrumb('/app/intern/today')).toEqual({
      parent: null,
      parentHref: null,
      current: 'Today',
      icon: 'layout',
    });
  });

  it('nests intern engagements under Clients with a clients href', () => {
    expect(shellBreadcrumb('/app/intern/engagements/pexpo-inc')).toEqual({
      parent: 'Clients',
      parentHref: '/app/intern/clients',
      current: 'Pexpo Inc',
      currentKey: 'pexpo-inc',
      icon: 'users',
    });
  });

  it('keeps step and board-resolution routes on the company leaf', () => {
    expect(
      shellBreadcrumb('/app/intern/engagements/pexpo-inc/step/client-details'),
    ).toMatchObject({
      parent: 'Clients',
      parentHref: '/app/intern/clients',
      current: 'Pexpo Inc',
      currentKey: 'pexpo-inc',
      icon: 'users',
    });
    expect(
      shellBreadcrumb('/app/intern/engagements/pexpo-inc/board-resolution'),
    ).toMatchObject({
      parent: 'Clients',
      current: 'Pexpo Inc',
    });
  });

  it('links project parents to the projects list', () => {
    expect(shellBreadcrumb('/app/manager/projects/pexpo-inc')).toEqual({
      parent: 'Projects',
      parentHref: '/app/manager/projects',
      current: 'Pexpo Inc',
      currentKey: 'pexpo-inc',
      icon: 'briefcase',
    });
    expect(shellBreadcrumb('/app/admin/projects/new')).toMatchObject({
      parent: 'Projects',
      parentHref: '/app/admin/projects',
      current: 'New project',
      icon: 'briefcase',
    });
  });
});

describe('resolveShellCrumbCurrent', () => {
  it('uses the live company name when the engagement is known', () => {
    const crumb = shellBreadcrumb('/app/intern/engagements/acme-holdings');
    expect(
      resolveShellCrumbCurrent(crumb, [
        { id: 'e1', slug: 'acme-holdings', companyName: 'Acme Holdings Pvt Ltd' },
      ]),
    ).toBe('Acme Holdings Pvt Ltd');
  });

  it('falls back to the title-cased slug when unmatched', () => {
    const crumb = shellBreadcrumb('/app/intern/engagements/pexpo-inc');
    expect(resolveShellCrumbCurrent(crumb, [])).toBe('Pexpo Inc');
  });
});
