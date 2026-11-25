/**
 * Zoho datacenter domain resolution.
 *
 * Ported to TypeScript from `src/dc.js` of the npm package @wanasapps/zoho-auth 1.3.1, and the
 * Books, Invoice, People and Payroll base URLs from `src/registry.js` of @wanasapps/zoho-api 1.5.2.
 * Additions for VCFO: `dcFromAccountsServer` and `isKnownAccountsServer`, which let the OAuth
 * callback trust Zoho's `accounts-server` only when it is one of Zoho's own hosts.
 *
 * MIT License
 *
 * Copyright (c) 2026 Wanas Apps
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Zoho splits hosts into families; the CA datacenter is the odd one out
 * (accounts.zohocloud.ca but www.zohoapis.ca).
 */

export const DCS = ['com', 'eu', 'in', 'com.au', 'au', 'jp', 'uk', 'ca', 'sa', 'ae', 'cn', 'sg'] as const;
export type ZohoDc = (typeof DCS)[number];

const ACCOUNTS: Record<string, string> = {
  com: 'https://accounts.zoho.com',
  eu: 'https://accounts.zoho.eu',
  in: 'https://accounts.zoho.in',
  'com.au': 'https://accounts.zoho.com.au',
  au: 'https://accounts.zoho.com.au',
  jp: 'https://accounts.zoho.jp',
  uk: 'https://accounts.zoho.uk',
  ca: 'https://accounts.zohocloud.ca',
  sa: 'https://accounts.zoho.sa',
  ae: 'https://accounts.zoho.ae',
  cn: 'https://accounts.zoho.com.cn',
  // Singapore: accounts.zoho.sg is live; Connect and Show document *.zoho.sg hosts.
  sg: 'https://accounts.zoho.sg',
};

export function normalizeDc(dc: string | null | undefined): string {
  const key = String(dc || 'com').toLowerCase().trim();
  return (DCS as readonly string[]).includes(key) ? (key === 'au' ? 'com.au' : key) : 'com';
}

export function accountsDomain(dc: string | null | undefined): string {
  return ACCOUNTS[normalizeDc(dc)] || ACCOUNTS.com!;
}

/** www.zohoapis.com family (CRM, Books, Invoice, Payroll ...) */
export function zohoapisDomain(dc: string | null | undefined): string {
  const key = normalizeDc(dc);
  if (key === 'ca') return 'https://www.zohoapis.ca';
  if (key === 'cn') return 'https://www.zohoapis.com.cn';
  return `https://www.zohoapis.${key}`;
}

/** <product>.zoho.com family (people, mail, desk ...) */
export function productDomain(product: string, dc: string | null | undefined): string {
  const key = normalizeDc(dc);
  if (key === 'ca') return `https://${product}.zohocloud.ca`;
  if (key === 'cn') return `https://${product}.zoho.com.cn`;
  return `https://${product}.zoho.${key}`;
}

/** True for a syntactically valid datacenter (used to reject typo'd values). */
export function isValidDc(dc: string | null | undefined): boolean {
  return (DCS as readonly string[]).includes(String(dc || '').toLowerCase().trim());
}

/**
 * Retarget an absolute www.zohoapis.com URL to the session's datacenter. Other hosts pass
 * through untouched.
 */
export function retargetZohoapisUrl(url: string, dc: string | null | undefined): string {
  return String(url).replace(/^https:\/\/www\.zohoapis\.com(?=\/|$)/i, zohoapisDomain(dc));
}

/**
 * Which Zoho CRM environment a token is bound to, read from the api_domain the token endpoint
 * returned: 'production', 'sandbox' or 'developer'; null when it is not a zohoapis host.
 */
export function environmentOfApiDomain(apiDomain: string | null | undefined): 'production' | 'sandbox' | 'developer' | null {
  const m = String(apiDomain || '').match(/^https?:\/\/(www|sandbox|developer)\.zohoapis\.[a-z.]+\/?$/i);
  if (!m) return null;
  const host = m[1]!.toLowerCase();
  return host === 'www' ? 'production' : (host as 'sandbox' | 'developer');
}

/* ---------------------------------------------------------------- VCFO additions */

/**
 * The datacenter of an `accounts-server` value Zoho put on the callback, or null when the host is
 * not one of Zoho's accounts hosts. The client secret is only ever sent to a host this accepts.
 */
export function dcFromAccountsServer(server: string | null | undefined): string | null {
  const s = String(server || '').trim().replace(/\/+$/, '').toLowerCase();
  if (!s) return null;
  for (const [dc, host] of Object.entries(ACCOUNTS)) {
    if (dc === 'au') continue;
    if (host === s) return dc;
  }
  return null;
}

export function isKnownAccountsServer(server: string | null | undefined): boolean {
  return dcFromAccountsServer(server) !== null;
}

/** True for an `api_domain` on one of Zoho's API hosts (www/sandbox/developer.zohoapis.*). */
export function isKnownApiDomain(apiDomain: string | null | undefined): boolean {
  const s = String(apiDomain || '').trim().replace(/\/+$/, '').toLowerCase();
  return DCS.some((dc) => {
    const base = zohoapisDomain(dc);
    return [base, base.replace('://www.', '://sandbox.'), base.replace('://www.', '://developer.')].includes(s);
  });
}

/** Zoho Payroll is served only from these datacenters (registry.js `payroll.dcs`). */
export const PAYROLL_DCS = ['com', 'in', 'ae', 'sa'];

/** Base URLs per app, from the stored `api_domain` (API family) and datacenter (People). */
export function appBaseUrl(app: 'books' | 'invoice' | 'crm' | 'payroll' | 'people', conn: { apiDomain: string; dc: string }): string {
  const api = conn.apiDomain.replace(/\/+$/, '');
  switch (app) {
    case 'books':
      return `${api}/books/v3`;
    case 'invoice':
      return `${api}/invoice/v3`;
    case 'crm':
      return `${api}/crm/v8`;
    case 'payroll':
      return `${api}/payroll/v1`;
    case 'people':
      return `${productDomain('people', conn.dc)}/people/api`;
  }
}
