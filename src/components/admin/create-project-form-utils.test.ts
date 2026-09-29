import { afterEach, describe, expect, it } from 'vitest';
import {
  createProjectReducer,
  loadCreateProjectDraft,
  parentIndianRelationshipForSubmit,
  parentIndianRelationshipMissing,
  type CreateProjectState,
} from './create-project-form-utils';

afterEach(() => {
  window.localStorage.clear();
});

describe('create-project draft', () => {
  it('an old draft without the field still loads, with no parent role', () => {
    window.localStorage.setItem(
      'vcfo.create-project.draft.v3',
      JSON.stringify({
        companyName: 'Acme',
        ownershipType: 'subsidiary',
        companyType: 'domestic',
        internIds: ['intern-1'],
      }),
    );
    const draft = loadCreateProjectDraft();
    expect(draft?.companyName).toBe('Acme');
    expect(draft?.parentIndianRelationship).toBeNull();
  });

  it('restores a saved parent role and drops junk values', () => {
    window.localStorage.setItem(
      'vcfo.create-project.draft.v3',
      JSON.stringify({ companyName: 'Acme', parentIndianRelationship: 'name_only' }),
    );
    expect(loadCreateProjectDraft()?.parentIndianRelationship).toBe('name_only');
    window.localStorage.setItem(
      'vcfo.create-project.draft.v3',
      JSON.stringify({ companyName: 'Acme', parentIndianRelationship: 'owner' }),
    );
    expect(loadCreateProjectDraft()?.parentIndianRelationship).toBeNull();
  });
});

describe('Indian parent role validity', () => {
  it.each([
    ['independent', 'domestic', null, false],
    ['subsidiary', 'foreign', null, false],
    ['subsidiary', 'domestic', null, true],
    ['subsidiary', 'domestic', 'name_only', false],
    ['subsidiary', 'domestic', 'investing', false],
  ] as const)('%s / %s / %s → missing=%s', (ownershipType, companyType, rel, missing) => {
    expect(
      parentIndianRelationshipMissing({
        ownershipType,
        companyType,
        parentIndianRelationship: rel,
      }),
    ).toBe(missing);
  });

  it('is only sent for Group company + Indian parent', () => {
    expect(
      parentIndianRelationshipForSubmit({
        ownershipType: 'subsidiary',
        companyType: 'foreign',
        parentIndianRelationship: 'investing',
      }),
    ).toBeNull();
    expect(
      parentIndianRelationshipForSubmit({
        ownershipType: 'subsidiary',
        companyType: 'domestic',
        parentIndianRelationship: 'investing',
      }),
    ).toBe('investing');
  });
});

describe('reducer', () => {
  const base = {
    ownershipType: 'subsidiary',
    companyType: 'domestic',
    parentIndianRelationship: 'investing',
  } as CreateProjectState;

  it('switching to a Foreign parent clears the role', () => {
    const next = createProjectReducer(base, { type: 'patch', patch: { companyType: 'foreign' } });
    expect(next.parentIndianRelationship).toBeNull();
  });

  it('switching to Standalone clears the role', () => {
    const next = createProjectReducer(base, {
      type: 'patch',
      patch: { ownershipType: 'independent', companyType: 'domestic' },
    });
    expect(next.parentIndianRelationship).toBeNull();
  });

  it('unrelated patches keep the role', () => {
    const next = createProjectReducer(base, { type: 'patch', patch: { companyName: 'X' } });
    expect(next.parentIndianRelationship).toBe('investing');
  });
});
