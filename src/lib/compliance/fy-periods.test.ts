import { describe, expect, it } from 'vitest';

import { getFyPeriods, toIso } from '@/lib/compliance/fy-periods';

describe('getFyPeriods', () => {
  it('creates a short first FY for mid-year incorporation', () => {
    const periods = getFyPeriods('2026-11-15', new Date('2028-03-31'));
    expect(periods[0]?.short).toBe(true);
    expect(toIso(periods[0]!.start)).toBe('2026-11-15');
    expect(toIso(periods[0]!.end)).toBe('2027-03-31');
    expect(periods[0]?.label).toBe('FY 2026-27');
  });

  it('creates a full FY when incorporated on 1 April', () => {
    const periods = getFyPeriods('2026-04-01', new Date('2027-03-31'));
    expect(periods[0]?.short).toBe(false);
    expect(toIso(periods[0]!.start)).toBe('2026-04-01');
    expect(toIso(periods[0]!.end)).toBe('2027-03-31');
  });
});
