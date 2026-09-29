import { describe, expect, it } from 'vitest';
import { NOC_VARIANTS, resolveNocVariant } from '@/lib/noc/variant';
import { NOC_TEMPLATES } from '@/lib/noc/templates';

describe('resolveNocVariant', () => {
  it.each([
    ['independent', 'domestic', null],
    ['independent', 'foreign', 'investing'],
    ['independent', 'domestic', 'name_only'],
  ])('standalone (%s / %s / %s) needs no NOC', (ownershipType, companyType, rel) => {
    expect(
      resolveNocVariant({ ownershipType, companyType, parentIndianRelationship: rel }),
    ).toBeNull();
  });

  it.each([null, 'name_only', 'investing'])(
    'foreign parent is foreign-parent whatever the relationship (%s)',
    (rel) => {
      expect(
        resolveNocVariant({
          ownershipType: 'subsidiary',
          companyType: 'foreign',
          parentIndianRelationship: rel,
        }),
      ).toBe('foreign-parent');
    },
  );

  it('Indian parent, name use only', () => {
    expect(
      resolveNocVariant({
        ownershipType: 'subsidiary',
        companyType: 'domestic',
        parentIndianRelationship: 'name_only',
      }),
    ).toBe('indian-name-only');
  });

  it('Indian parent, investing', () => {
    expect(
      resolveNocVariant({
        ownershipType: 'subsidiary',
        companyType: 'domestic',
        parentIndianRelationship: 'investing',
      }),
    ).toBe('indian-investing');
  });

  it('Indian parent with no role chosen is incomplete (null)', () => {
    expect(
      resolveNocVariant({
        ownershipType: 'subsidiary',
        companyType: 'domestic',
        parentIndianRelationship: null,
      }),
    ).toBeNull();
    expect(resolveNocVariant({ ownershipType: 'subsidiary', companyType: 'domestic' })).toBeNull();
  });

  it('missing ownershipType defaults to subsidiary (legacy rows)', () => {
    expect(resolveNocVariant({ companyType: 'foreign' })).toBe('foreign-parent');
  });

  it('every variant has a template registry entry', () => {
    for (const v of NOC_VARIANTS) {
      expect(NOC_TEMPLATES[v].variant).toBe(v);
      expect(NOC_TEMPLATES[v].downloadFilename).toMatch(/\.docx$/);
    }
  });
});
