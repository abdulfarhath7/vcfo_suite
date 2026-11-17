import { describe, expect, it } from 'vitest';
import { invoicePartnerIds, partnerOwns } from './co-partners';

const links = [
  { clientId: 'c1', partnerId: 'p2' },
  { clientId: 'c1', partnerId: 'p1' },
  { clientId: 'c2', partnerId: 'p3' },
];

describe('second partners', () => {
  it('lists the lead first, then the second partners, once each', () => {
    expect(invoicePartnerIds({ partnerId: 'p1', clientId: 'c1' }, links)).toEqual(['p1', 'p2']);
    expect(invoicePartnerIds({ partnerId: null, clientId: 'c2' }, links)).toEqual(['p3']);
    expect(invoicePartnerIds({ partnerId: 'p1', clientId: null }, links)).toEqual(['p1']);
  });

  it('a second partner owns the client but not other clients', () => {
    expect(partnerOwns('p2', { partnerId: 'p1', clientId: 'c1' }, links)).toBe(true);
    expect(partnerOwns('p2', { partnerId: 'p1', clientId: 'c2' }, links)).toBe(false);
  });
});
