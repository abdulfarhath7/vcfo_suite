import { describe, expect, it } from 'vitest';
import { companyStatusKind, dinStatusKind, kycKind } from './status';

describe('dinStatusKind', () => {
  it('reads a live DIN as good', () => {
    expect(dinStatusKind('Approved')).toBe('ok');
    expect(dinStatusKind('Active')).toBe('ok');
  });

  it('never reads "Inactive" as active (DIN 00000001 showed this as green)', () => {
    expect(dinStatusKind('Inactive')).toBe('bad');
    expect(dinStatusKind('INACTIVE')).toBe('bad');
  });

  it('reads the other dead states as bad', () => {
    for (const word of ['Disqualified', 'Deactivated', 'Surrendered', 'Lapsed', 'Cancelled']) {
      expect(dinStatusKind(word)).toBe('bad');
    }
  });

  it('says nothing about an empty or unknown word', () => {
    expect(dinStatusKind('')).toBe('idle');
    expect(dinStatusKind('Something else')).toBe('idle');
  });
});

describe('kycKind', () => {
  it('separates Done from Not Done', () => {
    expect(kycKind('Done')).toBe('ok');
    expect(kycKind('Not Done')).toBe('warn');
  });
});

describe('companyStatusKind', () => {
  it('reads the register words', () => {
    expect(companyStatusKind('Active')).toBe('ok');
    expect(companyStatusKind('Strike Off')).toBe('bad');
    expect(companyStatusKind('Under liquidation')).toBe('bad');
    expect(companyStatusKind('Amalgamated')).toBe('bad');
    expect(companyStatusKind('')).toBe('idle');
  });

  it('does not call an inactive company active either', () => {
    expect(companyStatusKind('Inactive')).toBe('bad');
  });
});
