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
    expect(shouldShowShellBack('/app/intern/today')).toBe(false);
    expect(shouldShowShellBack('/app/intern')).toBe(false);
    expect(shouldShowShellBack('/app/intern/tasks')).toBe(true);
    expect(shouldShowShellBack('/app/intern/announcements')).toBe(true);
    expect(shouldShowShellBack('/app/intern/notifications')).toBe(true);
    expect(shouldShowShellBack('/app/intern/clients')).toBe(true);
    expect(shouldShowShellBack('/app/intern/clients/')).toBe(true);
    expect(shouldShowShellBack('/app/intern/vault')).toBe(true);
    expect(shouldShowShellBack('/app/intern/compliance')).toBe(true);
    expect(shouldShowShellBack('/app/intern/knowledge-bank')).toBe(true);
    expect(shouldShowShellBack('/app/intern/mail')).toBe(true);
    expect(shouldShowShellBack('/app/intern/analytics')).toBe(true);
    expect(shouldShowShellBack('/app/intern/audit-log')).toBe(true);
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
    expect(shouldShowShellBack('/app/intern/compliance/tracker')).toBe(true);
  });

  it('hides on other-role homes only; other primary pages get a back control', () => {
    expect(shouldShowShellBack('/app/manager/dashboard')).toBe(false);
    expect(shouldShowShellBack('/app/admin/dashboard')).toBe(false);
    expect(shouldShowShellBack('/app/super/dashboard')).toBe(false);
    expect(shouldShowShellBack('/app/client/inbox')).toBe(false);
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
