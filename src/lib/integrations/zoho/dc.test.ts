import { describe, expect, it } from 'vitest';
import { accountsDomain, appBaseUrl, dcFromAccountsServer, isKnownApiDomain, normalizeDc, productDomain, zohoapisDomain } from './dc';

describe('Zoho datacenters', () => {
  it('normalises au to com.au and unknown values to com', () => {
    expect(normalizeDc('au')).toBe('com.au');
    expect(normalizeDc('IN ')).toBe('in');
    expect(normalizeDc('mars')).toBe('com');
  });

  it('resolves the odd CA and CN hosts', () => {
    expect(accountsDomain('ca')).toBe('https://accounts.zohocloud.ca');
    expect(zohoapisDomain('ca')).toBe('https://www.zohoapis.ca');
    expect(zohoapisDomain('cn')).toBe('https://www.zohoapis.com.cn');
    expect(productDomain('people', 'in')).toBe('https://people.zoho.in');
  });

  it('trusts only Zoho accounts servers from the callback', () => {
    expect(dcFromAccountsServer('https://accounts.zoho.in')).toBe('in');
    expect(dcFromAccountsServer('https://accounts.zoho.in/')).toBe('in');
    expect(dcFromAccountsServer('https://accounts.zoho.com.au')).toBe('com.au');
    expect(dcFromAccountsServer('https://accounts.zoho.in.evil.example')).toBeNull();
    expect(dcFromAccountsServer('http://accounts.zoho.in')).toBeNull();
    expect(dcFromAccountsServer('')).toBeNull();
  });

  it('accepts api_domain values on Zoho API hosts only', () => {
    expect(isKnownApiDomain('https://www.zohoapis.in')).toBe(true);
    expect(isKnownApiDomain('https://sandbox.zohoapis.com')).toBe(true);
    expect(isKnownApiDomain('https://www.zohoapis.in.attacker.io')).toBe(false);
  });

  it('builds each app base URL from the stored api_domain', () => {
    const conn = { apiDomain: 'https://www.zohoapis.in/', dc: 'in' };
    expect(appBaseUrl('books', conn)).toBe('https://www.zohoapis.in/books/v3');
    expect(appBaseUrl('invoice', conn)).toBe('https://www.zohoapis.in/invoice/v3');
    expect(appBaseUrl('payroll', conn)).toBe('https://www.zohoapis.in/payroll/v1');
    expect(appBaseUrl('crm', conn)).toBe('https://www.zohoapis.in/crm/v8');
    expect(appBaseUrl('people', conn)).toBe('https://people.zoho.in/people/api');
  });
});
