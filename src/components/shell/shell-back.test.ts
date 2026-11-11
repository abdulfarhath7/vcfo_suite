import { describe, expect, it } from 'vitest';
import {
  resolveShellBackAction,
  shellBackFallbackPath,
  shouldShowShellBack,
} from './shell-back';

describe('shouldShowShellBack', () => {
  it('hides on marketing and login', () => {
    expect(shouldShowShellBack('/')).toBe(false);
    expect(shouldShowShellBack('/login')).toBe(false);
    expect(shouldShowShellBack('/roles')).toBe(false);
  });

  it('hides only on intern Today / role index, not other intern pages', () => {
    expect(shouldShowShellBack('/app/lead/today')).toBe(false);
    expect(shouldShowShellBack('/app/lead')).toBe(false);
    expect(shouldShowShellBack('/app/lead/tasks')).toBe(true);
    expect(shouldShowShellBack('/app/lead/announcements')).toBe(true);
    expect(shouldShowShellBack('/app/lead/notifications')).toBe(true);
    expect(shouldShowShellBack('/app/lead/clients')).toBe(true);
    expect(shouldShowShellBack('/app/lead/clients/')).toBe(true);
    expect(shouldShowShellBack('/app/lead/vault')).toBe(true);
    expect(shouldShowShellBack('/app/lead/compliances/calendar')).toBe(true);
    expect(shouldShowShellBack('/app/lead/knowledge-bank')).toBe(true);
    expect(shouldShowShellBack('/app/lead/mail')).toBe(true);
    expect(shouldShowShellBack('/app/lead/analytics')).toBe(true);
    expect(shouldShowShellBack('/app/lead/audit-log')).toBe(true);
  });

  it('shows on intern settings, engagement, step, and board-resolution', () => {
    expect(shouldShowShellBack('/app/lead/settings')).toBe(true);
    expect(shouldShowShellBack('/app/lead/engagements/pexpo-inc')).toBe(true);
    expect(shouldShowShellBack('/app/lead/engagements/pexpo-inc/step/spice-part-a')).toBe(
      true,
    );
    expect(shouldShowShellBack('/app/lead/engagements/pexpo-inc/board-resolution')).toBe(
      true,
    );
    expect(shouldShowShellBack('/app/lead/compliances/filings')).toBe(true);
  });

  it('hides on other-role homes only; other primary pages get a back control', () => {
    expect(shouldShowShellBack('/app/manager/dashboard')).toBe(false);
    expect(shouldShowShellBack('/app/admin/dashboard')).toBe(false);
    expect(shouldShowShellBack('/app/super/dashboard')).toBe(false);
    expect(shouldShowShellBack('/app/client/overview')).toBe(false);
    expect(shouldShowShellBack('/app/client/documents')).toBe(true);
    expect(shouldShowShellBack('/app/admin/projects')).toBe(true);
    expect(shouldShowShellBack('/app/manager/notifications')).toBe(true);
    expect(shouldShowShellBack('/app/client/notifications')).toBe(true);
    expect(shouldShowShellBack('/app/client/incorporation')).toBe(true);
    expect(shouldShowShellBack('/app/admin/people')).toBe(true);
  });

  it('shows on staff project detail, new project, step, settings, and people extra segments', () => {
    expect(shouldShowShellBack('/app/admin/projects/pexpo-inc')).toBe(true);
    expect(shouldShowShellBack('/app/manager/projects/new')).toBe(true);
    expect(shouldShowShellBack('/app/admin/projects/pexpo-inc/step/pre-1')).toBe(true);
    expect(shouldShowShellBack('/app/manager/settings')).toBe(true);
    expect(shouldShowShellBack('/app/admin/settings')).toBe(true);
    expect(shouldShowShellBack('/app/super/settings')).toBe(true);
    expect(shouldShowShellBack('/app/client/settings')).toBe(true);
    expect(shouldShowShellBack('/app/admin/people/mgr-1')).toBe(true);
    expect(shouldShowShellBack('/app/client/board-resolution')).toBe(true);
  });
});

describe('shellBackFallbackPath', () => {
  it('returns clients from intern engagement detail', () => {
    expect(shellBackFallbackPath('/app/lead/engagements/pexpo-inc')).toBe(
      '/app/lead/clients',
    );
  });

  it('returns the engagement from intern step and board-resolution', () => {
    expect(shellBackFallbackPath('/app/lead/engagements/pexpo-inc/step/pre-2')).toBe(
      '/app/lead/engagements/pexpo-inc',
    );
    expect(shellBackFallbackPath('/app/lead/engagements/pexpo-inc/board-resolution')).toBe(
      '/app/lead/engagements/pexpo-inc',
    );
  });

  it('returns the project list from project detail and the project from a step', () => {
    expect(shellBackFallbackPath('/app/admin/projects/pexpo-inc')).toBe('/app/admin/projects');
    expect(shellBackFallbackPath('/app/manager/projects/new')).toBe('/app/manager/projects');
    expect(shellBackFallbackPath('/app/admin/projects/pexpo-inc/step/pre-1')).toBe(
      '/app/admin/projects/pexpo-inc',
    );
  });

  it('returns role home from settings', () => {
    expect(shellBackFallbackPath('/app/lead/settings')).toBe('/app/lead/today');
    expect(shellBackFallbackPath('/app/manager/settings')).toBe('/app/manager/dashboard');
    expect(shellBackFallbackPath('/app/client/settings')).toBe('/app/client/overview');
    expect(shellBackFallbackPath('/app/super/settings')).toBe('/app/super/dashboard');
  });

  it('walks up to home from the Compliances children, never the redirecting group index', () => {
    expect(shellBackFallbackPath('/app/lead/compliances/calendar')).toBe('/app/lead/today');
    expect(shellBackFallbackPath('/app/manager/compliances/filings')).toBe('/app/manager/dashboard');
    expect(shellBackFallbackPath('/app/admin/compliances/filings')).toBe('/app/admin/dashboard');
    expect(shellBackFallbackPath('/app/client/compliances/calendar')).toBe('/app/client/overview');
  });

  it('returns incorporation from the client board-resolution page', () => {
    expect(shellBackFallbackPath('/app/client/board-resolution')).toBe(
      '/app/client/incorporation',
    );
  });
});

describe('resolveShellBackAction', () => {
  it('uses history when the session can go back', () => {
    expect(resolveShellBackAction('/app/lead/engagements/pexpo-inc', 3)).toEqual({
      kind: 'history',
    });
  });

  it('uses the parent path when history length is 1', () => {
    expect(resolveShellBackAction('/app/lead/engagements/pexpo-inc', 1)).toEqual({
      kind: 'href',
      href: '/app/lead/clients',
    });
  });
});

describe('resolveShellBackAction — step workspaces', () => {
  it('walks up to the phase list from a lead step, even with history to burn', () => {
    expect(
      resolveShellBackAction('/app/lead/engagements/pexpo-inc/step/name-application', 9),
    ).toEqual({ kind: 'href', href: '/app/lead/engagements/pexpo-inc' });
  });

  it('walks up to the phase list from a client step', () => {
    expect(resolveShellBackAction('/app/client/incorporation/step/name-application', 9)).toEqual({
      kind: 'href',
      href: '/app/client/incorporation',
    });
  });

  it('walks up from an admin project step too', () => {
    expect(
      resolveShellBackAction('/app/admin/projects/acme-india/step/name-application', 5),
    ).toEqual({ kind: 'href', href: '/app/admin/projects/acme-india' });
  });

  it('still prefers history off a step route', () => {
    expect(resolveShellBackAction('/app/lead/engagements/pexpo-inc', 3)).toEqual({
      kind: 'history',
    });
  });
});
