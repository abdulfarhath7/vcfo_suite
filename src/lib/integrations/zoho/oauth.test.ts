import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const ENV = { ...process.env };
beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-1';
  process.env.ZOHO_CLIENT_ID = '1000.ABC';
  process.env.ZOHO_CLIENT_SECRET = 'shh';
  process.env.SITE_URL = 'http://localhost:3000';
});
afterEach(() => {
  process.env = { ...ENV };
});

const oauth = await import('./oauth');

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('Zoho OAuth', () => {
  it('asks one consent with read scopes for every app, offline, at accounts.zoho.com', () => {
    const url = new URL(oauth.zohoAuthorizeUrl('st'));
    expect(url.origin).toBe('https://accounts.zoho.com');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/integrations/zoho/callback');
    const scopes = url.searchParams.get('scope')!.split(',');
    expect(scopes).toContain('ZohoBooks.invoices.READ');
    expect(scopes).toContain('ZohoPayroll.payrollrun.READ');
    expect(scopes).toContain('ZOHOPEOPLE.attendance.READ');
    expect(scopes.every((s) => /READ$/i.test(s))).toBe(true);
  });

  it('narrows the consent with ZOHO_APPS', () => {
    expect(oauth.consentApps({ ZOHO_APPS: 'books, crm' })).toEqual(['books', 'crm']);
    expect(oauth.consentApps({ ZOHO_APPS: 'nonsense' })).toEqual(oauth.ZOHO_APPS);
    expect(oauth.appsInScopes('ZohoBooks.invoices.READ,ZohoCRM.org.READ')).toEqual(['books', 'crm']);
  });

  it('signs the state for one user and expires it after 15 minutes', () => {
    const now = Date.now();
    const s = oauth.createZohoState('u1', now);
    expect(oauth.parseZohoState(s, 'u1', now + 1000)).toBe(true);
    expect(oauth.parseZohoState(s, 'u2', now + 1000)).toBe(false);
    expect(oauth.parseZohoState(s, 'u1', now + 16 * 60_000)).toBe(false);
    expect(oauth.parseZohoState(`${s.split('.')[0]}.forged`, 'u1', now)).toBe(false);
  });

  it('exchanges the code at the accounts server Zoho named, and keeps api_domain', async () => {
    const fetchImpl = vi.fn(async () => reply({ access_token: 'a', refresh_token: 'r', api_domain: 'https://www.zohoapis.in', expires_in: 3600 })) as unknown as typeof fetch;
    const t = await oauth.exchangeZohoCode('code', 'https://accounts.zoho.in', fetchImpl);
    expect(t.api_domain).toBe('https://www.zohoapis.in');
    expect(String((fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0])).toBe('https://accounts.zoho.in/oauth/v2/token');
  });

  it('never sends the secret to a host that is not Zoho', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(oauth.exchangeZohoCode('code', 'https://accounts.zoho.in.evil.io', fetchImpl)).rejects.toThrow('unknown_accounts_server');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a token reply with a foreign api_domain', async () => {
    const fetchImpl = vi.fn(async () => reply({ access_token: 'a', refresh_token: 'r', api_domain: 'https://evil.io' })) as unknown as typeof fetch;
    await expect(oauth.exchangeZohoCode('code', 'https://accounts.zoho.com', fetchImpl)).rejects.toThrow('unknown_api_domain');
  });

  it('turns a 200 with an error into a ZohoTokenError on refresh', async () => {
    const fetchImpl = vi.fn(async () => reply({ error: 'invalid_code' })) as unknown as typeof fetch;
    await expect(oauth.refreshZohoToken('r', 'https://accounts.zoho.com', fetchImpl)).rejects.toMatchObject({ code: 'invalid_code' });
  });

  it('revokes at the same accounts server and reports a failure instead of throwing', async () => {
    const ok = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    await expect(oauth.revokeZohoToken('r', 'https://accounts.zoho.eu', ok)).resolves.toEqual({ ok: true });
    expect(String((ok as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0])).toBe('https://accounts.zoho.eu/oauth/v2/token/revoke?token=r');
    const down = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(oauth.revokeZohoToken('r', 'https://accounts.zoho.eu', down)).resolves.toMatchObject({ ok: false });
  });
});
