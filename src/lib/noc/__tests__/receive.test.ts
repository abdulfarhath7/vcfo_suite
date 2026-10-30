import { describe, expect, it } from 'vitest';
import { resolveNocVariant } from '@/lib/noc/variant';
import {
  allChecksTicked,
  answersForVariant,
  nocReceiveChecks,
  nocTrackKeys,
  nocVariantPath,
  withNocVariantOverride,
} from '@/lib/noc/receive';
import { diffNocFields, nocSnapshotFields } from '@/lib/noc/fields';
import { buildBoardResolutionMergeFields } from '@/lib/board-resolution/board-resolution';

describe('NOC track (C2)', () => {
  it('has six steps for a foreign parent', () => {
    expect(nocTrackKeys(true)).toEqual(['drafted', 'released', 'signed', 'notarised', 'apostilled', 'accepted']);
  });
  it('has four steps for an Indian parent', () => {
    expect(nocTrackKeys(false)).toEqual(['drafted', 'released', 'signed', 'accepted']);
  });
  it('drops the notary steps when SBC turned them off (D1)', () => {
    expect(nocTrackKeys(true, true)).toHaveLength(4);
  });
});

describe('receive checklist (T5)', () => {
  it('has six checks for a foreign parent and four for an Indian one', () => {
    expect(nocReceiveChecks(true).map((c) => c.key)).toEqual([
      'director_signature',
      'date_place',
      'letterhead',
      'notary_stamp',
      'apostille',
      'names_match',
    ]);
    expect(nocReceiveChecks(false).map((c) => c.key)).toEqual(['director_signature', 'date_place', 'letterhead', 'names_match']);
  });
  it('unlocks Accept only when every check is ticked', () => {
    const checks = nocReceiveChecks(false);
    expect(allChecksTicked(checks, {})).toBe(false);
    expect(allChecksTicked(checks, { director_signature: 1, date_place: 1, letterhead: 1 })).toBe(false);
    expect(allChecksTicked(checks, { director_signature: 1, date_place: 1, letterhead: 1, names_match: 1 })).toBe(true);
  });
});

describe('decision path (C8) follows resolveNocVariant()', () => {
  const cases = [
    ['foreign', { ownershipType: 'subsidiary', companyType: 'foreign', parentIndianRelationship: null }, 'foreign-parent'],
    ['Indian name use', { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'name_only' }, 'indian-name-only'],
    ['Indian investing', { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: 'investing' }, 'indian-investing'],
    ['Indian not chosen', { ownershipType: 'subsidiary', companyType: 'domestic', parentIndianRelationship: null }, 'incomplete'],
    ['standalone', { ownershipType: 'independent', companyType: 'domestic', parentIndianRelationship: null }, 'none'],
  ] as const;
  it.each(cases)('%s', (_name, answers, result) => {
    const path = nocVariantPath(answers);
    expect(path.result).toBe(result);
    const v = resolveNocVariant(answers);
    if (v) expect(path.result).toBe(v);
    else expect(['none', 'incomplete']).toContain(path.result);
  });
  it('marks the role "not chosen" for an Indian parent with no role', () => {
    expect(nocVariantPath({ ownershipType: 'subsidiary', companyType: 'domestic' }).role).toBe('not_chosen');
  });
});

describe('template override', () => {
  it.each(['foreign-parent', 'indian-name-only', 'indian-investing'] as const)('answers for %s resolve back to it', (v) => {
    expect(resolveNocVariant(answersForVariant(v))).toBe(v);
  });
  it('keeps the other engagement fields', () => {
    const e = withNocVariantOverride({ id: 'x', companyType: 'foreign', ownershipType: 'subsidiary' }, 'indian-investing');
    expect(e).toMatchObject({ id: 'x', companyType: 'domestic', parentIndianRelationship: 'investing' });
    expect(withNocVariantOverride({ companyType: 'foreign' }, null)).toEqual({ companyType: 'foreign' });
  });
});

describe('snapshot and compare (T3, T4)', () => {
  const fields = buildBoardResolutionMergeFields({ pre1: { parentEntityName: 'Parent A' } });
  it('drops the today-fallback dates when Pre-1 has no resolution date', () => {
    const snap = nocSnapshotFields(fields, 'foreign-parent', false);
    expect(snap).not.toHaveProperty('CERTIFICATION_DATE');
    expect(nocSnapshotFields(fields, 'foreign-parent', true)).toHaveProperty('CERTIFICATION_DATE');
  });
  it('lists the changed values with labels, the template included', () => {
    const a = nocSnapshotFields(fields, 'foreign-parent', false);
    const b = { ...a, PARENT_ENTITY_NAME: 'Parent B', __variant: 'indian-investing' };
    expect(diffNocFields(a, b)).toEqual([
      { key: '__variant', label: 'Template', before: 'foreign-parent', after: 'indian-investing' },
      { key: 'PARENT_ENTITY_NAME', label: 'Parent name', before: 'Parent A', after: 'Parent B' },
    ]);
    expect(diffNocFields(a, a)).toEqual([]);
  });
});
