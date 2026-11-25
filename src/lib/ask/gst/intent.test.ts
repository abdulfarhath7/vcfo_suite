import { describe, expect, it } from 'vitest';
import { companyFromGstMessage, gstButtonMessage, gstIntent } from './intent';

describe('gstIntent', () => {
  it.each([
    ['do GST registration for Kestrel', 'readiness', 'kestrel'],
    ['Register Kestrel Labs for GST', 'readiness', 'kestrel labs'],
    ['please start the GST registration for Kestrel Labs Private Limited', 'readiness', 'kestrel labs private limited'],
    ['GST registration for Kestrel', 'readiness', 'kestrel'],
    ['file REG-01 for Kestrel', 'readiness', 'kestrel'],
    ['Is Kestrel ready for GST registration?', 'readiness', 'kestrel'],
    ["do Kestrel's GST registration", 'readiness', 'kestrel'],
    ['do GST registration', 'readiness', null],
    ['Fetch the GST registration papers for Kestrel from SharePoint', 'fetch_sharepoint', 'kestrel'],
    ['Ask Kestrel for the GST registration details', 'ask_client', 'kestrel'],
    ['Start Kestrel on the GST portal for registration', 'start_portal', 'kestrel'],
  ])('%s', (text, kind, company) => {
    expect(gstIntent(text)).toEqual({ kind, company });
  });

  it.each([
    'what is GST registration?',
    'how long does GST registration take',
    'why do we need GST registration for exports',
    'file the GSTR-3B for Kestrel',
    'GST returns due this month',
    'register Kestrel for PF',
    '',
  ])('is not a GST registration request: %s', (text) => {
    expect(gstIntent(text)).toBeNull();
  });

  it('reads back every button message as its own intent', () => {
    for (const kind of ['fetch_sharepoint', 'ask_client', 'start_portal'] as const) {
      expect(gstIntent(gstButtonMessage(kind, 'Test Company Private Limited'))).toEqual({ kind, company: 'test company private limited' });
    }
  });

  it('does not take a pronoun for a company', () => {
    expect(companyFromGstMessage('do GST registration for this client')).toBeNull();
    expect(companyFromGstMessage('register it for GST')).toBeNull();
  });
});
