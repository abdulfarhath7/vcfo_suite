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

  it('hides on intern sidebar homes and the clients list', () => {
    expect(shouldShowShellBack('/app/intern/today')).toBe(false);
    expect(shouldShowShellBack('/app/intern/tasks')).toBe(false);
    expect(shouldShowShellBack('/app/intern/announcements')).toBe(false);
    expect(shouldShowShellBack('/app/intern/clients')).toBe(false);
    expect(shouldShowShellBack('/app/intern/clients/')).toBe(false);
    expect(shouldShowShellBack('/app/intern/vault')).toBe(false);
    expect(shouldShowShellBack('/app/intern/compliance')).toBe(false);
    expect(shouldShowShellBack('/app/intern/knowledge-bank')).toBe(false);
    expect(shouldShowShellBack('/app/intern/mail')).toBe(false);
    expect(shouldShowShellBack('/app/intern/requests')).toBe(false);
    expect(shouldShowShellBack('/app/intern/analytics')).toBe(false);
    expect(shouldShowShellBack('/app/intern/audit-log')).toBe(false);
    expect(shouldShowShellBack('/app/intern')).toBe(false);
  });

  it('shows on intern settings, engagement, step, and board-resolution', () => {
    expect(shouldShowShellBack('/app/intern/settings')).toBe(true);
    expect(shouldShowShellBack('/app/intern/engagements/pexpo-inc')).toBe(true);
    expect(shouldShowShellBack('/app/intern/engagements/pexpo-inc/step/spice-part-a')).toBe(
      true,
    );
    expect(shouldShowShellBack('/app/intern/engagements/pexpo-inc/board-resolution')).toBe(
      true,
    );
  });

  it('hides on manager, admin, super, and client primary nav', () => {
    expect(shouldShowShellBack('/app/manager/dashboard')).toBe(false);
    expect(shouldShowShellBack('/app/admin/projects')).toBe(false);
    expect(shouldShowShellBack('/app/super/dashboard')).toBe(false);
    expect(shouldShowShellBack('/app/client/inbox')).toBe(false);
    expect(shouldShowShellBack('/app/client/incorporation')).toBe(false);
    expect(shouldShowShellBack('/app/admin/people')).toBe(false);
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
    expect(shellBackFallbackPath('/app/intern/engagements/pexpo-inc')).toBe(
      '/app/intern/clients',
    );
  });

  it('returns the engagement from intern step and board-resolution', () => {
    expect(shellBackFallbackPath('/app/intern/engagements/pexpo-inc/step/pre-2')).toBe(
      '/app/intern/engagements/pexpo-inc',
    );
    expect(shellBackFallbackPath('/app/intern/engagements/pexpo-inc/board-resolution')).toBe(
      '/app/intern/engagements/pexpo-inc',
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
    expect(shellBackFallbackPath('/app/intern/settings')).toBe('/app/intern/today');
    expect(shellBackFallbackPath('/app/manager/settings')).toBe('/app/manager/dashboard');
    expect(shellBackFallbackPath('/app/client/settings')).toBe('/app/client/inbox');
    expect(shellBackFallbackPath('/app/super/settings')).toBe('/app/super/dashboard');
  });

  it('returns incorporation from the client board-resolution page', () => {
    expect(shellBackFallbackPath('/app/client/board-resolution')).toBe(
      '/app/client/incorporation',
    );
  });
});

describe('resolveShellBackAction', () => {
  it('uses history when the session can go back', () => {
    expect(resolveShellBackAction('/app/intern/engagements/pexpo-inc', 3)).toEqual({
      kind: 'history',
    });
  });

  it('uses the parent path when history length is 1', () => {
    expect(resolveShellBackAction('/app/intern/engagements/pexpo-inc', 1)).toEqual({
      kind: 'href',
      href: '/app/intern/clients',
    });
  });
});
