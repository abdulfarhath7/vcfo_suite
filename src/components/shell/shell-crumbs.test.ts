import { describe, expect, it } from 'vitest';
import {
  pageTitleRepeatsTrail,
  resolveShellCrumbCurrent,
  shellBreadcrumb,
  shellCrumbParent,
} from './shell-crumbs';

function labels(pathname: string) {
  return shellBreadcrumb(pathname).segments.map((seg) => seg.label);
}

function hrefs(pathname: string) {
  return shellBreadcrumb(pathname).segments.map((seg) => seg.href);
}

describe('shellBreadcrumb', () => {
  it('names the role home after its first sidebar row', () => {
    expect(shellBreadcrumb('/app/lead/today')).toEqual({ icon: 'home', segments: [{ label: 'Today', href: null }] });
    expect(labels('/app/manager/dashboard')).toEqual(['Today']);
    expect(labels('/app/admin/dashboard')).toEqual(['Today']);
    expect(labels('/app/client/overview')).toEqual(['Home']);
    expect(labels('/app/super/dashboard')).toEqual(['Overview']);
  });

  it('never starts with a Home crumb', () => {
    expect(labels('/app/lead/clients')).toEqual(['Clients']);
    expect(labels('/app/lead/tasks')).toEqual(['Work']);
    expect(labels('/app/lead/mail')).toEqual(['Email']);
    expect(labels('/app/admin/people')).toEqual(['People']);
  });

  it('nests announcements and notifications under Updates', () => {
    expect(labels('/app/lead/announcements')).toEqual(['Updates', 'Announcements']);
    expect(hrefs('/app/lead/announcements')).toEqual(['/app/lead/announcements', null]);
    expect(shellBreadcrumb('/app/manager/notifications').icon).toBe('bell');
  });

  it('nests vault and knowledge bank under Docs', () => {
    expect(labels('/app/lead/vault')).toEqual(['Docs', 'Vault']);
    expect(labels('/app/manager/knowledge-bank')).toEqual(['Docs', 'Knowledge bank']);
    expect(shellCrumbParent('knowledge-bank')).toBe('Docs');
    expect(shellCrumbParent('compliances')).toBe('Compliances');
  });

  it('NV-03: a record or step page shows the list, the client, the SPICe+ part and the page', () => {
    // The client's real name replaces the slug once the projects load (resolveShellCrumbSegments).
    expect(labels('/app/lead/engagements/pexpo-inc')).toEqual(['Clients', 'Pexpo inc']);
    expect(labels('/app/lead/engagements/pexpo-inc/step/name-application')).toEqual([
      'Clients',
      'Pexpo inc',
      'SPICe+ Part A',
      'Client Details',
    ]);
    expect(labels('/app/manager/projects/pexpo-inc/step/kyc-review-and-dsc-creation')[0]).toBe('Projects');
    expect(labels('/app/client/incorporation/step/name-application')).toEqual(['Incorporation', 'SPICe+ Part A', 'Client Details']);
  });

  it('NV-03: every segment but the last is a link, for the same client', () => {
    expect(hrefs('/app/lead/engagements/pexpo-inc/step/name-application')).toEqual([
      '/app/lead/clients',
      '/app/lead/engagements/pexpo-inc',
      '/app/lead/engagements/pexpo-inc/step/name-application',
      null,
    ]);
    expect(hrefs('/app/client/incorporation/step/name-application')).toEqual([
      '/app/client/incorporation',
      '/app/client/incorporation/phase/1',
      null,
    ]);
  });

  it('names the pages that have no sidebar row', () => {
    expect(labels('/app/lead/engagements/pexpo-inc/documents')).toEqual(['Clients', 'Pexpo inc', 'Documents']);
    expect(labels('/app/manager/projects/pexpo-inc/board-resolution')).toEqual(['Projects', 'Pexpo inc', 'Board resolution']);
    expect(labels('/app/client/board-resolution')).toEqual(['Incorporation', 'Board resolution']);
    expect(labels('/app/admin/projects/new')).toEqual(['Projects', 'New project']);
  });

  it('never shows a raw id', () => {
    expect(labels('/app/manager/registrations/0c3489fd-fb41-4b22-9e1a-111111111111~reg-4')).toEqual(['Registrations']);
  });

  it('nests Calendar and Filings under Compliances for every shell', () => {
    expect(labels('/app/lead/compliances/filings')).toEqual(['Compliances', 'Filings']);
    expect(hrefs('/app/lead/compliances/filings')).toEqual(['/app/lead/compliances/calendar', null]);
    expect(labels('/app/admin/compliances/calendar')).toEqual(['Compliances', 'Calendar']);
    // The super admin has no calendar route of its own; the parent opens the firm-wide one.
    expect(hrefs('/app/super/compliances/expiries')).toEqual(['/app/admin/compliances/calendar', null]);
    expect(shellBreadcrumb('/app/client/compliances/filings').icon).toBe('calendar');
  });
});

describe('pageTitleRepeatsTrail', () => {
  it('treats route names that match the last crumb as redundant', () => {
    expect(pageTitleRepeatsTrail('Calendar', '/app/lead/compliances/calendar')).toBe(true);
    expect(pageTitleRepeatsTrail('filings', '/app/manager/compliances/filings')).toBe(true);
    expect(pageTitleRepeatsTrail('Work', '/app/lead/tasks')).toBe(true);
    expect(pageTitleRepeatsTrail('Email', '/app/lead/mail')).toBe(true);
    expect(pageTitleRepeatsTrail('New project', '/app/admin/projects/new')).toBe(true);
  });

  it('keeps titles that add information beyond the trail leaf', () => {
    expect(pageTitleRepeatsTrail('Statutory calendar', '/app/lead/compliances/calendar')).toBe(false);
    expect(pageTitleRepeatsTrail("Bird's-eye overview", '/app/super/dashboard')).toBe(false);
  });
});

describe('resolveShellCrumbCurrent', () => {
  it('reads the leaf of the trail', () => {
    expect(resolveShellCrumbCurrent(shellBreadcrumb('/app/lead/engagements/acme-holdings/documents'), [])).toBe('Documents');
    expect(resolveShellCrumbCurrent(shellBreadcrumb('/app/lead/clients'), [])).toBe('Clients');
  });
});
