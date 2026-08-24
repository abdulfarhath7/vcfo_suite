import { describe, expect, it } from 'vitest';
import { shellBreadcrumb, shellCrumbParent } from './shell-crumbs';

describe('shellBreadcrumb', () => {
  it('nests announcements and notifications under Updates', () => {
    expect(shellBreadcrumb('/app/intern/announcements')).toEqual({
      parent: 'Updates',
      current: 'Announcements',
    });
    expect(shellBreadcrumb('/app/manager/notifications')).toEqual({
      parent: 'Updates',
      current: 'Notifications',
    });
  });

  it('nests vault and knowledge bank under Docs', () => {
    expect(shellBreadcrumb('/app/intern/vault')).toEqual({ parent: 'Docs', current: 'Vault' });
    expect(shellCrumbParent('knowledge-bank')).toBe('Docs');
  });

  it('uses the page name alone on top-level homes', () => {
    expect(shellBreadcrumb('/app/intern/today')).toEqual({ parent: null, current: 'Today' });
  });
});
