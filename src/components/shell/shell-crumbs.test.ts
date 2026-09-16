import { describe, expect, it } from 'vitest';
import { getPreIncPhases } from '@/data/checklist';
import {
  pageTitleRepeatsTrail,
  resolveShellCrumbCurrent,
  resolveShellCrumbSegments,
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
  it('is Home-only on role homes', () => {
    expect(shellBreadcrumb('/app/intern/today')).toEqual({
      icon: 'home',
      segments: [{ label: 'Home', href: null }],
    });
    expect(shellBreadcrumb('/app/manager/dashboard').segments).toEqual([
      { label: 'Home', href: null },
    ]);
    expect(shellBreadcrumb('/app/client/overview').segments).toEqual([
      { label: 'Home', href: null },
    ]);
  });

  it('starts every other page with a linked Home', () => {
    expect(hrefs('/app/intern/clients')[0]).toBe('/app/intern/today');
    expect(hrefs('/app/manager/projects')[0]).toBe('/app/manager/dashboard');
    expect(hrefs('/app/admin/people')[0]).toBe('/app/admin/dashboard');
    expect(hrefs('/app/client/incorporation')[0]).toBe('/app/client/overview');
  });

  it('nests announcements and notifications under Updates with a real announcements href', () => {
    expect(labels('/app/intern/announcements')).toEqual(['Home', 'Updates', 'Announcements']);
    expect(hrefs('/app/intern/announcements')).toEqual([
      '/app/intern/today',
      '/app/intern/announcements',
      null,
    ]);
    expect(shellBreadcrumb('/app/manager/notifications')).toMatchObject({
      icon: 'bell',
      segments: [
        { label: 'Home', href: '/app/manager/dashboard' },
        { label: 'Updates', href: '/app/manager/announcements' },
        { label: 'Notifications', href: null },
      ],
    });
  });

  it('nests vault and knowledge bank under Docs with a vault href', () => {
    expect(labels('/app/intern/vault')).toEqual(['Home', 'Docs', 'Vault']);
    expect(hrefs('/app/intern/vault')).toEqual(['/app/intern/today', '/app/intern/vault', null]);
    expect(shellCrumbParent('knowledge-bank')).toBe('Docs');
    expect(shellCrumbParent('compliances')).toBe('Compliances');
    expect(shellBreadcrumb('/app/manager/knowledge-bank')).toMatchObject({
      icon: 'folder',
      segments: [
        { label: 'Home', href: '/app/manager/dashboard' },
        { label: 'Docs', href: '/app/manager/vault' },
        { label: 'Knowledge Bank', href: null },
      ],
    });
  });

  it('links client board resolution under Incorporation and SPICe+ Part A', () => {
    expect(labels('/app/client/board-resolution')).toEqual([
      'Home',
      'Incorporation',
      'SPICe+ Part A',
      'Board Resolution',
    ]);
    expect(hrefs('/app/client/board-resolution')).toEqual([
      '/app/client/overview',
      '/app/client/incorporation',
      '/app/client/incorporation',
      null,
    ]);
  });

  it('nests intern engagements under Clients with a clients href', () => {
    expect(shellBreadcrumb('/app/intern/engagements/pexpo-inc')).toEqual({
      icon: 'users',
      segments: [
        { label: 'Home', href: '/app/intern/today' },
        { label: 'Clients', href: '/app/intern/clients' },
        { label: 'Pexpo Inc', href: null, engagementKey: 'pexpo-inc' },
      ],
    });
  });

  it('expands intern step routes to company, intern phase, and step title', () => {
    const crumb = shellBreadcrumb(
      '/app/intern/engagements/democo/step/kyc-review-and-dsc-creation',
    );
    expect(crumb.segments.map((seg) => seg.label)).toEqual([
      'Home',
      'Clients',
      'Democo',
      'SPICe+ Part B',
      'KYC Review & DSC',
    ]);
    expect(crumb.segments.map((seg) => seg.href)).toEqual([
      '/app/intern/today',
      '/app/intern/clients',
      '/app/intern/engagements/democo',
      `/app/intern/engagements/democo/step/${getPreIncPhases()[1]!.items[0]!.slug}`,
      null,
    ]);
    expect(crumb.segments[2]?.engagementKey).toBe('democo');
  });

  it('uses SPICe+ Part A for Client Details, not Part B', () => {
    expect(labels('/app/intern/engagements/pexpo-inc/step/name-application')).toEqual([
      'Home',
      'Clients',
      'Pexpo Inc',
      'SPICe+ Part A',
      'Client Details',
    ]);
  });

  it('links intern board-resolution under SPICe+ Part A', () => {
    expect(labels('/app/intern/engagements/pexpo-inc/board-resolution')).toEqual([
      'Home',
      'Clients',
      'Pexpo Inc',
      'SPICe+ Part A',
      'Board Resolution',
    ]);
    expect(hrefs('/app/intern/engagements/pexpo-inc/board-resolution')[3]).toBe(
      '/app/intern/engagements/pexpo-inc/step/name-application',
    );
  });

  it('includes intern Registration sub-headers', () => {
    expect(labels('/app/intern/engagements/pexpo-inc/step/gst-registration')).toEqual([
      'Home',
      'Clients',
      'Pexpo Inc',
      'Registration',
      'General',
      'GST Registration',
    ]);
  });

  it('expands staff project steps the same way without intern-only headings', () => {
    expect(labels('/app/manager/projects/pexpo-inc/step/kyc-review-and-dsc-creation')).toEqual([
      'Home',
      'Projects',
      'Pexpo Inc',
      'SPICe+ Part B',
      'KYC Review & DSC',
    ]);
    expect(hrefs('/app/manager/projects/pexpo-inc/step/kyc-review-and-dsc-creation')[2]).toBe(
      '/app/manager/projects/pexpo-inc',
    );
    expect(labels('/app/manager/projects/pexpo-inc/step/gst-registration')).toEqual([
      'Home',
      'Projects',
      'Pexpo Inc',
      'Registration',
      'GST Registration',
    ]);
  });

  it('links project parents to the projects list', () => {
    expect(shellBreadcrumb('/app/manager/projects/pexpo-inc')).toEqual({
      icon: 'briefcase',
      segments: [
        { label: 'Home', href: '/app/manager/dashboard' },
        { label: 'Projects', href: '/app/manager/projects' },
        { label: 'Pexpo Inc', href: null, engagementKey: 'pexpo-inc' },
      ],
    });
    expect(labels('/app/admin/projects/new')).toEqual(['Home', 'Projects', 'New project']);
  });

  it('nests Calendar and Filings under Compliances for every shell', () => {
    expect(labels('/app/intern/compliances/filings')).toEqual(['Home', 'Compliances', 'Filings']);
    expect(hrefs('/app/intern/compliances/filings')).toEqual([
      '/app/intern/today',
      '/app/intern/compliances/calendar',
      null,
    ]);
    expect(labels('/app/admin/compliances/calendar')).toEqual(['Home', 'Compliances', 'Calendar']);
    expect(hrefs('/app/admin/compliances/calendar')).toEqual([
      '/app/admin/dashboard',
      '/app/admin/compliances/calendar',
      null,
    ]);
    expect(labels('/app/manager/compliances/filings')).toEqual(['Home', 'Compliances', 'Filings']);
    expect(labels('/app/client/compliances/calendar')).toEqual(['Home', 'Compliances', 'Calendar']);
    expect(shellBreadcrumb('/app/client/compliances/filings').icon).toBe('calendar');
  });
});

describe('pageTitleRepeatsTrail', () => {
  it('treats route names that match the last crumb as redundant', () => {
    expect(pageTitleRepeatsTrail('Calendar', '/app/intern/compliances/calendar')).toBe(true);
    expect(pageTitleRepeatsTrail('filings', '/app/manager/compliances/filings')).toBe(true);
    expect(pageTitleRepeatsTrail('Vault', '/app/intern/vault')).toBe(true);
    expect(pageTitleRepeatsTrail('Knowledge Bank', '/app/manager/knowledge-bank')).toBe(true);
    expect(pageTitleRepeatsTrail('Announcements', '/app/intern/announcements')).toBe(true);
    expect(pageTitleRepeatsTrail('My work', '/app/intern/tasks')).toBe(true);
    expect(pageTitleRepeatsTrail('Clients', '/app/intern/clients')).toBe(true);
    expect(pageTitleRepeatsTrail('Notifications', '/app/manager/notifications')).toBe(true);
    expect(pageTitleRepeatsTrail('Audit Log', '/app/admin/audit-log')).toBe(true);
    expect(pageTitleRepeatsTrail('Send email', '/app/intern/mail')).toBe(true);
    expect(pageTitleRepeatsTrail('New project', '/app/admin/projects/new')).toBe(true);
  });

  it('keeps titles that add information beyond the trail leaf', () => {
    expect(pageTitleRepeatsTrail('Statutory calendar', '/app/intern/compliances/calendar')).toBe(false);
    expect(pageTitleRepeatsTrail('Compliance calendar', '/app/admin/compliances/calendar')).toBe(false);
    expect(pageTitleRepeatsTrail('GCC Setup Projects', '/app/manager/projects')).toBe(false);
    expect(pageTitleRepeatsTrail('Project leads', '/app/manager/team')).toBe(false);
    expect(pageTitleRepeatsTrail("Bird's-eye overview", '/app/super/dashboard')).toBe(false);
    expect(pageTitleRepeatsTrail('Firm home', '/app/admin/dashboard')).toBe(false);
    expect(pageTitleRepeatsTrail('Dashboard', '/app/manager/dashboard')).toBe(false);
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
    const step = shellBreadcrumb(
      '/app/intern/engagements/acme-holdings/step/kyc-review-and-dsc-creation',
    );
    const resolved = resolveShellCrumbSegments(step, [
      { id: 'e1', slug: 'acme-holdings', companyName: 'Acme Holdings Pvt Ltd' },
    ]);
    expect(resolved.map((seg) => seg.label)).toEqual([
      'Home',
      'Clients',
      'Acme Holdings Pvt Ltd',
      'SPICe+ Part B',
      'KYC Review & DSC',
    ]);
  });

  it('falls back to the title-cased slug when unmatched', () => {
    const crumb = shellBreadcrumb('/app/intern/engagements/pexpo-inc');
    expect(resolveShellCrumbCurrent(crumb, [])).toBe('Pexpo Inc');
  });

  it('matches a company name slug when the engagement slug is missing', () => {
    const crumb = shellBreadcrumb('/app/intern/engagements/democo');
    expect(
      resolveShellCrumbCurrent(crumb, [{ id: 'e1', slug: null, companyName: 'DemoCo' }]),
    ).toBe('DemoCo');
  });
});

describe('client incorporation step trail', () => {
  it('names the resolved step, not the URL slug', () => {
    // `name-application` is pre-1 "Client Details"; the step titled
    // "Name Application" is pre-4 (`name-application-filing`). Labelling the
    // crumb from the slug made the trail contradict the page.
    expect(labels('/app/client/incorporation/step/name-application')).toEqual([
      'Home',
      'Incorporation',
      'SPICe+ Part A',
      'Client Details',
    ]);
    expect(labels('/app/client/incorporation/step/name-application-filing')).toEqual([
      'Home',
      'Incorporation',
      'SPICe+ Part A',
      'Name Application',
    ]);
  });

  it('links the phase crumb back to that phase', () => {
    expect(hrefs('/app/client/incorporation/step/board-resolution-draft')).toEqual([
      '/app/client/overview',
      '/app/client/incorporation',
      '/app/client/incorporation?phase=pre-inc-phase-1',
      null,
    ]);
  });
});
