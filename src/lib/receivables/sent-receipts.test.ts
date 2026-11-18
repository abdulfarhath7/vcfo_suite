import { describe, expect, it } from 'vitest';
import { alreadySentHits } from './sent-receipts';

describe('alreadySentHits', () => {
  const map = { inv1: [{ email: 'pranay@x.com', sentAt: '2026-11-12T05:00:00Z' }] };
  it('flags a received invoice already sent to the same person, in any case', () => {
    expect(alreadySentHits(map, ['inv1', 'inv2'], ['Pranay@X.com'])).toEqual([{ invoiceId: 'inv1', email: 'pranay@x.com', sentAt: '2026-11-12T05:00:00Z' }]);
  });
  it('lets it go to someone else', () => {
    expect(alreadySentHits(map, ['inv1'], ['jeyansh@x.com'])).toEqual([]);
  });
});
