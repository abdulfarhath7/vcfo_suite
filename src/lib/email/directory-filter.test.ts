import { describe, expect, it } from 'vitest';
import {
  clientRecipientsForProject,
  filterDirectoryPeople,
  kindForRole,
  uniqueDirectoryManagers,
  uniqueDirectoryProjects,
  type DirectoryPerson,
  type DirectoryProject,
} from './directory-filter';

const demo: DirectoryProject = { id: 'e1', slug: 'democo', companyName: 'DemoCo' };
const acme: DirectoryProject = { id: 'e2', slug: 'acme', companyName: 'Acme' };

const people: DirectoryPerson[] = [
  {
    userId: 'm1',
    name: 'Pranay Kumar',
    email: 'pranay.k@sbcllp.in',
    role: 'manager',
    kind: 'firm',
    status: 'active',
    reportsToManagerId: null,
    managerName: null,
    projects: [demo],
  },
  {
    userId: 'l1',
    name: 'Sasi Kumar',
    email: 'sasikumar@sbcllp.in',
    role: 'intern',
    kind: 'firm',
    status: 'active',
    reportsToManagerId: 'm1',
    managerName: 'Pranay Kumar',
    projects: [demo, acme],
  },
  {
    userId: 'c1',
    name: 'Founder',
    email: 'founder@democo.in',
    role: 'client',
    kind: 'client',
    status: 'inactive',
    reportsToManagerId: null,
    managerName: null,
    projects: [demo],
  },
];

describe('kindForRole', () => {
  it('treats non-clients as firm', () => {
    expect(kindForRole('manager')).toBe('firm');
    expect(kindForRole('intern')).toBe('firm');
    expect(kindForRole('client')).toBe('client');
  });
});

describe('filterDirectoryPeople', () => {
  it('filters firm vs client', () => {
    expect(
      filterDirectoryPeople(people, { kind: 'firm', status: 'all' }).map((p) => p.userId),
    ).toEqual(['m1', 'l1']);
    expect(
      filterDirectoryPeople(people, { kind: 'client', status: 'all' }).map((p) => p.userId),
    ).toEqual(['c1']);
  });

  it('defaults to active status', () => {
    expect(filterDirectoryPeople(people, {}).map((p) => p.userId)).toEqual(['m1', 'l1']);
  });

  it('filters by team (reports-to manager)', () => {
    expect(
      filterDirectoryPeople(people, { managerId: 'm1', status: 'all' }).map((p) => p.userId),
    ).toEqual(['m1', 'l1']);
  });

  it('filters by role and project', () => {
    expect(
      filterDirectoryPeople(people, { role: 'manager', projectId: 'e1' }).map((p) => p.email),
    ).toEqual(['pranay.k@sbcllp.in']);
  });

  it('searches name and email', () => {
    expect(filterDirectoryPeople(people, { query: 'pranay.k' }).map((p) => p.userId)).toEqual([
      'm1',
    ]);
    expect(filterDirectoryPeople(people, { query: 'sasi' }).map((p) => p.userId)).toEqual(['l1']);
    expect(filterDirectoryPeople(people, { query: 'democo' }).map((p) => p.userId)).toEqual([]);
  });
});

describe('uniqueDirectoryProjects', () => {
  it('dedupes projects by id', () => {
    expect(uniqueDirectoryProjects(people).map((p) => p.slug).sort()).toEqual(['acme', 'democo']);
  });
});

describe('uniqueDirectoryManagers', () => {
  it('lists unique reports-to managers', () => {
    expect(uniqueDirectoryManagers(people)).toEqual([{ id: 'm1', name: 'Pranay Kumar' }]);
  });
});

describe('clientRecipientsForProject', () => {
  const member: DirectoryPerson = {
    userId: 'c2',
    name: 'Ops',
    email: 'ops@democo.in',
    role: 'client',
    kind: 'client',
    status: 'active',
    reportsToManagerId: null,
    managerName: null,
    projects: [demo],
  };
  const owner: DirectoryPerson = {
    userId: 'c-owner',
    name: 'Founder Active',
    email: 'ceo@democo.in',
    role: 'client',
    kind: 'client',
    status: 'active',
    reportsToManagerId: null,
    managerName: null,
    projects: [demo],
    primaryForProjectIds: ['e1'],
  };

  it('fills To with active client emails, primary first', () => {
    const roster = [...people, member, owner];
    expect(clientRecipientsForProject(roster, 'e1').map((p) => p.email)).toEqual([
      'ceo@democo.in',
      'ops@democo.in',
    ]);
  });

  it('falls back to inactive client email when no active contact exists', () => {
    expect(clientRecipientsForProject(people, 'e1').map((p) => p.email)).toEqual([
      'founder@democo.in',
    ]);
  });

  it('returns empty for all or unknown company', () => {
    expect(clientRecipientsForProject(people, 'all')).toEqual([]);
    expect(clientRecipientsForProject(people, 'missing')).toEqual([]);
  });
});
