import { describe, expect, it } from 'vitest';
import {
  filterDirectoryPeople,
  kindForRole,
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
    projects: [demo],
  },
  {
    userId: 'l1',
    name: 'Sasi Kumar',
    email: 'sasikumar@sbcllp.in',
    role: 'intern',
    kind: 'firm',
    projects: [demo, acme],
  },
  {
    userId: 'c1',
    name: 'Founder',
    email: 'founder@democo.in',
    role: 'client',
    kind: 'client',
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
    expect(filterDirectoryPeople(people, { kind: 'firm' }).map((p) => p.userId)).toEqual([
      'm1',
      'l1',
    ]);
    expect(filterDirectoryPeople(people, { kind: 'client' }).map((p) => p.userId)).toEqual(['c1']);
  });

  it('filters by role and project', () => {
    expect(
      filterDirectoryPeople(people, { role: 'manager', projectId: 'e1' }).map((p) => p.email),
    ).toEqual(['pranay.k@sbcllp.in']);
  });

  it('searches name email and company', () => {
    expect(filterDirectoryPeople(people, { query: 'pranay' }).map((p) => p.userId)).toEqual(['m1']);
    expect(filterDirectoryPeople(people, { query: 'democo' }).map((p) => p.userId).sort()).toEqual([
      'c1',
      'l1',
      'm1',
    ]);
  });
});

describe('uniqueDirectoryProjects', () => {
  it('dedupes projects by id', () => {
    expect(uniqueDirectoryProjects(people).map((p) => p.slug).sort()).toEqual(['acme', 'democo']);
  });
});
