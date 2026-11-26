// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GstzenError, createGstzenClient, jwtExpiryMs } from './client';

/**
 * The GSTZen client against a mocked fetch: JWT login with the firm's GSTZen account (form
 * encoded), the Bearer header, the token cache until shortly before expiry, one re-login after a
 * 401, plain errors for refusals and timeouts, the validator's Token header, and no logging.
 */

const ENV = { GSTZEN_BASE_URL: 'https://gsp.test/', GSTZEN_USERNAME: 'firm@sbc.test', GSTZEN_PASSWORD: 'pw-secret', GSTZEN_API_TOKEN: 'api-token-1' };

function jwt(expSec: number): string {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256' })}.${b({ exp: expSec, token_type: 'access' })}.sig`;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Call = { url: string; init: RequestInit };

function mockFetch(handler: (c: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    const c = { url, init };
    calls.push(c);
    return handler(c);
  });
  return { fn, calls };
}

afterEach(() => vi.restoreAllMocks());

describe('GSTZen client', () => {
  it('reads a JWT expiry', () => {
    expect(jwtExpiryMs(jwt(1_700_000_000))).toBe(1_700_000_000_000);
    expect(jwtExpiryMs('nope')).toBeNull();
  });

  it('logs in once, sends Bearer calls and caches the token', async () => {
    let now = 1_000_000_000_000;
    const access = jwt(now / 1000 + 24 * 3600);
    const { fn, calls } = mockFetch(({ url }) => (url.endsWith('/accounts/api/login/token/') ? json({ access, refresh: 'r' }) : json({ status: 1, api_call: 'OTPREQUEST', message: 'OTP sent successfully.' })));
    const c = createGstzenClient({ env: ENV, fetch: fn, now: () => now });
    await expect(c.generateOtp('29AAFCC9980M1ZR', 'portal-user')).resolves.toBe('OTP sent successfully.');
    await c.checkSession('29AAFCC9980M1ZR');
    expect(calls.map((x) => x.url)).toEqual(['https://gsp.test/accounts/api/login/token/', 'https://gsp.test/api/gstn-generate-otp/', 'https://gsp.test/api/gstn-check-session/']);
    const login = calls[0].init;
    expect((login.headers as Record<string, string>)['content-type']).toBe('application/x-www-form-urlencoded');
    expect(String(login.body)).toBe('username=firm%40sbc.test&password=pw-secret');
    expect((calls[1].init.headers as Record<string, string>).authorization).toBe(`Bearer ${access}`);
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ gstin: '29AAFCC9980M1ZR', username: 'portal-user' });

    // Shortly before expiry the token is fetched again.
    now += 24 * 3600 * 1000 - 5 * 60 * 1000;
    await c.checkSession('29AAFCC9980M1ZR');
    expect(calls.filter((x) => x.url.endsWith('/login/token/'))).toHaveLength(2);
  });

  it('logs in again once after a 401', async () => {
    let n = 0;
    const { fn, calls } = mockFetch(({ url }) => {
      if (url.endsWith('/login/token/')) return json({ access: jwt(Date.now() / 1000 + 86400) });
      n += 1;
      return n === 1 ? json({ detail: 'expired' }, 401) : json({ status: 1, message: { status_cd: 'P' } });
    });
    const c = createGstzenClient({ env: ENV, fetch: fn });
    await expect(c.returnStatus('gstr3b', 'G', '102026', 'ref')).resolves.toEqual({ status_cd: 'P' });
    expect(calls.filter((x) => x.url.endsWith('/login/token/'))).toHaveLength(2);
    expect(calls.at(-1)!.url).toBe('https://gsp.test/api/retstatus/');
  });

  it('turns a refusal into one plain sentence', async () => {
    const { fn } = mockFetch(({ url }) => (url.endsWith('/login/token/') ? json({ access: jwt(Date.now() / 1000 + 86400) }) : json({ status: 0, message: 'Invalid OTP' })));
    const c = createGstzenClient({ env: ENV, fetch: fn });
    const err = (await c.establishSession('G', '123456').catch((e: unknown) => e)) as GstzenError;
    expect(err).toBeInstanceOf(GstzenError);
    expect(err).toMatchObject({ kind: 'portal', message: 'Invalid OTP' });
    expect(err.message).not.toContain('123456');
  });

  it('refuses before any call when GSTZen is not configured', async () => {
    const { fn } = mockFetch(() => json({}));
    const c = createGstzenClient({ env: { GSTZEN_USERNAME: '', GSTZEN_PASSWORD: '' }, fetch: fn });
    await expect(c.checkSession('G')).rejects.toMatchObject({ kind: 'not_configured' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('reports a failed login plainly', async () => {
    const { fn } = mockFetch(() => json({ detail: 'No active account found with the given credentials' }, 401));
    const c = createGstzenClient({ env: ENV, fetch: fn });
    await expect(c.checkSession('G')).rejects.toMatchObject({ kind: 'login' });
  });

  it('times out with a plain message', async () => {
    const fn = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_r, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
    const c = createGstzenClient({ env: ENV, fetch: fn, timeoutMs: 20 });
    await expect(c.validateGstin('29AAFQQ9980MZQR')).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('uses the Token header for the validator when the API token is set, else the JWT endpoint', async () => {
    const { fn, calls } = mockFetch(({ url }) => (url.endsWith('/login/token/') ? json({ access: jwt(Date.now() / 1000 + 86400) }) : json({ status: 1, valid: true, gstin: 'X' })));
    await createGstzenClient({ env: ENV, fetch: fn }).validateGstin('X');
    expect(calls[0].url).toBe('https://gsp.test/api/gstin-validator/');
    expect((calls[0].init.headers as Record<string, string>).Token).toBe('api-token-1');
    await createGstzenClient({ env: { ...ENV, GSTZEN_API_TOKEN: '' }, fetch: fn }).validateGstin('X');
    expect(calls.at(-1)!.url).toBe('https://gsp.test/api/j/gstin-validator/');
  });

  it('sends the EVC filing payload each form expects', async () => {
    const { fn, calls } = mockFetch(({ url }) => (url.endsWith('/login/token/') ? json({ access: jwt(Date.now() / 1000 + 86400) }) : json({ status: 1, message: { ack_num: 'AA1' } })));
    const c = createGstzenClient({ env: ENV, fetch: fn });
    await c.fileWithEvc('gstr1', 'G', '102026', { otp: '123456', signatoryPan: 'ABCDE1234F', dataJsonString: '{"a":1}' });
    await c.fileWithEvc('gstr3b', 'G', '102026', { otp: '123456', signatoryPan: 'ABCDE1234F', jsonData: { a: 1 } });
    await c.generateEvcOtp('gstr9', 'G', '032026', 'ABCDE1234F');
    const bodies = calls.filter((x) => !x.url.endsWith('/login/token/')).map((x) => ({ url: x.url, body: JSON.parse(String(x.init.body)) }));
    expect(bodies[0]).toEqual({ url: 'https://gsp.test/api/gstr1/retfile-evc/', body: { gstin: 'G', ret_period: '102026', otp: '123456', authorized_signatory_pan: 'ABCDE1234F', data_json_string: '{"a":1}' } });
    expect(bodies[1].url).toBe('https://gsp.test/api/gstr3b/retfile-evc/');
    expect(bodies[1].body.json_data).toEqual({ a: 1 });
    expect(bodies[2].url).toBe('https://gsp.test/api/gstr9/generate-evc-otp/');
  });

  it('never writes to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const { fn } = mockFetch(({ url }) => (url.endsWith('/login/token/') ? json({ access: jwt(Date.now() / 1000 + 86400) }) : json({ status: 0, message: 'Invalid OTP' })));
    const c = createGstzenClient({ env: ENV, fetch: fn });
    await c.establishSession('G', '654321').catch(() => undefined);
    await c.gstr3bSummary('G', '102026').catch(() => undefined);
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});
