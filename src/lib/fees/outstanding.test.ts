import { describe, expect, it } from 'vitest';
import { ageBucket, outstandingOf, rupees } from './outstanding';

describe('outstandingOf', () => {
  it('is null when nothing is billed and unpaid', () => {
    expect(outstandingOf([{ amountRupees: 5000, status: 'paid', billedOn: '2026-09-01' }], '2026-10-30')).toBeNull();
    expect(outstandingOf([{ amountRupees: 5000, status: 'not_billed', billedOn: null }], '2026-10-30')).toBeNull();
  });

  it('adds the billed lines and ages from the oldest invoice', () => {
    const out = outstandingOf(
      [
        { amountRupees: 25000, status: 'billed', billedOn: '2026-09-15' },
        { amountRupees: 10000, status: 'billed', billedOn: '2026-10-20' },
        { amountRupees: 9000, status: 'paid', billedOn: '2026-08-01' },
      ],
      '2026-10-30',
    );
    expect(out).toEqual({ amountRupees: 35000, days: 45, bucket: '31 to 60 days' });
  });
});

describe('ageBucket and rupees', () => {
  it('buckets by days', () => {
    expect(ageBucket(0)).toBe('0 to 30 days');
    expect(ageBucket(75)).toBe('61 to 90 days');
    expect(ageBucket(120)).toBe('Over 90 days');
  });
  it('groups in the Indian style', () => {
    expect(rupees(125000)).toBe('₹1,25,000');
  });
});
