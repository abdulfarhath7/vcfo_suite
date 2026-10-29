import { describe, expect, it } from 'vitest';
import type { DirectoryPerson } from '@/lib/email/directory-filter';
import { fillMergeFields, firstName, mergeValuesFor } from './merge-fields';

function person(over: Partial<DirectoryPerson>): DirectoryPerson {
  return {
    userId: 'u1',
    name: 'Rohan Mehta',
    email: 'rohan@example.com',
    role: 'client',
    kind: 'client',
    status: 'active',
    reportsToManagerId: null,
    managerName: null,
    projects: [{ id: 'e1', slug: 'acme', companyName: 'Acme Pvt Ltd' }],
    ...over,
  };
}

describe('fillMergeFields', () => {
  it('fills every field that has a value', () => {
    expect(fillMergeFields('Hi {name}, {client} is on {step}.', { client: 'Acme', name: 'Rohan', step: 'Name approval' })).toBe(
      'Hi Rohan, Acme is on Name approval.',
    );
  });

  it('leaves a field with no value as written', () => {
    expect(fillMergeFields('Hi {name}, {step}', { name: 'Rohan', step: null })).toBe('Hi Rohan, {step}');
  });
});

describe('mergeValuesFor', () => {
  it('reads the first client contact, its first company and that company step', () => {
    const team = person({ userId: 't1', name: 'Pranay K', kind: 'firm', role: 'manager', projects: [] });
    const values = mergeValuesFor([team, person({})], (id) => (id === 'e1' ? 'Name approval' : null));
    expect(values).toEqual({ client: 'Acme Pvt Ltd', name: 'Rohan', step: 'Name approval' });
  });

  it('gives nothing when no client contact is picked', () => {
    expect(mergeValuesFor([person({ kind: 'firm', role: 'manager' })], () => 'x')).toEqual({});
  });

  it('takes the first word of a name', () => {
    expect(firstName('  Rohan  Mehta ')).toBe('Rohan');
  });
});
