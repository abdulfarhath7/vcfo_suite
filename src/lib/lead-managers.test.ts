import { describe, expect, it } from 'vitest';
import type { DirectoryPerson } from '@/lib/email/directory-filter';
import {
  collectLeadManagerIds,
  internManagerComposeHref,
  resolveLeadManagers,
} from './lead-managers';

function person(partial: Partial<DirectoryPerson> & Pick<DirectoryPerson, 'userId' | 'role'>): DirectoryPerson {
  const email = partial.email ?? `${partial.userId}@vcfo.local`;
  return {
    name: partial.name ?? partial.userId,
    email,
    kind: partial.role === 'client' ? 'client' : 'firm',
    status: partial.status ?? 'active',
    reportsToManagerId: partial.reportsToManagerId ?? null,
    managerName: partial.managerName ?? null,
    projects: partial.projects ?? [],
    ...partial,
  };
}

describe('collectLeadManagerIds', () => {
  it('unions reports-to, primary manager, and co-managers', () => {
    expect(
      collectLeadManagerIds(
        [
          { managerId: 'm-primary', managerIds: ['m-primary', 'm-co'] },
          { managerId: '  ', managerIds: [null as unknown as string, ' m-co '] },
        ],
        ' m-reports ',
      ).sort(),
    ).toEqual(['m-co', 'm-primary', 'm-reports']);
  });
});

describe('resolveLeadManagers', () => {
  const reports = person({ userId: 'm-reports', role: 'manager', name: 'Reports To', email: 'reports@vcfo.local' });
  const primary = person({ userId: 'm-primary', role: 'manager', name: 'Primary PM', email: 'primary@vcfo.local' });
  const co = person({ userId: 'm-co', role: 'manager', name: 'Co Manager', email: 'co@vcfo.local' });
  const lead = person({ userId: 'intern-1', role: 'intern', name: 'Lead' });
  const client = person({ userId: 'c1', role: 'client', name: 'Client' });

  it('lists reports-to from intern-scoped directory when there are no companies', () => {
    expect(resolveLeadManagers([], [reports, lead, client])).toEqual([
      { id: 'm-reports', name: 'Reports To', email: 'reports@vcfo.local' },
    ]);
  });

  it('dedupes reports-to and engagement manager as one row', () => {
    expect(
      resolveLeadManagers([{ managerId: 'm-reports' }], [reports], 'm-reports'),
    ).toEqual([{ id: 'm-reports', name: 'Reports To', email: 'reports@vcfo.local' }]);
  });

  it('includes engagement PMs and co-managers, sorted by name', () => {
    expect(
      resolveLeadManagers(
        [{ managerId: 'm-primary', managerIds: ['m-co'] }],
        [co, primary, reports],
        'm-reports',
      ).map((m) => m.id),
    ).toEqual(['m-co', 'm-primary', 'm-reports']);
  });

  it('includes directory managers not listed on the engagement (co-managers / reports-to)', () => {
    expect(
      resolveLeadManagers([{ managerId: 'm-primary' }], [primary, co, reports]).map((m) => m.id),
    ).toEqual(['m-co', 'm-primary', 'm-reports']);
  });

  it('skips inactive managers and people without email', () => {
    const inactive = person({
      userId: 'm-old',
      role: 'manager',
      name: 'Former',
      status: 'inactive',
    });
    const noEmail = person({ userId: 'm-blank', role: 'manager', name: 'Blank', email: '  ' });
    expect(resolveLeadManagers([], [inactive, noEmail, reports])).toEqual([
      { id: 'm-reports', name: 'Reports To', email: 'reports@vcfo.local' },
    ]);
  });

  it('returns empty when none', () => {
    expect(resolveLeadManagers([], [lead, client])).toEqual([]);
  });
});

describe('internManagerComposeHref', () => {
  it('puts the recipient on intern compose', () => {
    expect(internManagerComposeHref('manager@vcfo.local')).toBe(
      '/app/intern/mail?to=manager%40vcfo.local',
    );
  });
});
