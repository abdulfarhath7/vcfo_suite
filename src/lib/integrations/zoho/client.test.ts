import { describe, expect, it, vi } from 'vitest';
import { RateLimiter, ZohoApiError, ZohoClient } from './client';

function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function make(responses: Array<() => Response>, opts: Partial<ConstructorParameters<typeof ZohoClient>[0]> = {}) {
  const calls: Array<{ url: string; auth: string | null; org: string | null }> = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    calls.push({ url: String(url), auth: h.get('authorization'), org: h.get('x-com-zoho-invoice-organizationid') });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    return next();
  }) as unknown as typeof fetch;
  const tokens = vi.fn(async (force?: boolean) => (force ? 'fresh' : 'stale'));
  const sleep = vi.fn(async () => undefined);
  const client = new ZohoClient({ baseUrl: 'https://www.zohoapis.in/books/v3', orgId: '123', orgParam: 'query', getAccessToken: tokens, fetchImpl, sleep, limiter: new RateLimiter(1000), ...opts });
  return { client, calls, tokens, sleep };
}

describe('ZohoClient', () => {
  it('sends the org id and the Zoho token header', async () => {
    const { client, calls } = make([() => reply(200, { code: 0, organizations: [] })]);
    await client.get('/organizations');
    expect(calls[0]!.url).toBe('https://www.zohoapis.in/books/v3/organizations?organization_id=123');
    expect(calls[0]!.auth).toBe('Zoho-oauthtoken stale');
  });

  it('puts the Invoice org in a header', async () => {
    const { client, calls } = make([() => reply(200, { code: 0 })], { baseUrl: 'https://www.zohoapis.in/invoice/v3', orgParam: 'header' });
    await client.get('/invoices');
    expect(calls[0]!.url).not.toContain('organization_id');
    expect(calls[0]!.org).toBe('123');
  });

  it('refreshes the token once on 401 and retries', async () => {
    const { client, calls, tokens } = make([() => reply(401, { code: 57, message: 'expired' }), () => reply(200, { code: 0, ok: 1 })]);
    await expect(client.get('/x')).resolves.toMatchObject({ ok: 1 });
    expect(tokens).toHaveBeenLastCalledWith(true);
    expect(calls[1]!.auth).toBe('Zoho-oauthtoken fresh');
  });

  it('gives up after a second 401', async () => {
    const { client } = make([() => reply(401, { message: 'no' }), () => reply(401, { message: 'still no' })]);
    await expect(client.get('/x')).rejects.toBeInstanceOf(ZohoApiError);
  });

  it('backs off on 429, honouring Retry-After, then succeeds', async () => {
    const { client, sleep } = make([() => reply(429, {}, { 'retry-after': '3' }), () => reply(429, {}), () => reply(200, { code: 0, ok: 1 })]);
    await expect(client.get('/x')).resolves.toMatchObject({ ok: 1 });
    expect(sleep).toHaveBeenNthCalledWith(1, 3000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it('stops retrying 429 after maxRetries', async () => {
    const { client } = make([() => reply(429, {}), () => reply(429, {}), () => reply(429, { message: 'slow down' })], { maxRetries: 2 });
    await expect(client.get('/x')).rejects.toMatchObject({ status: 429 });
  });

  it('treats a non-zero code in a 200 as an error', async () => {
    const { client } = make([() => reply(200, { code: 1002, message: 'Organization does not exist' })]);
    await expect(client.get('/x')).rejects.toMatchObject({ code: 1002 });
  });

  it('pages Books lists until has_more_page is false', async () => {
    const { client, calls } = make([
      () => reply(200, { code: 0, contacts: [{ id: 1 }, { id: 2 }], page_context: { has_more_page: true } }),
      () => reply(200, { code: 0, contacts: [{ id: 3 }], page_context: { has_more_page: false } }),
    ]);
    const all = await client.all<{ id: number }>('/contacts', 'contacts');
    expect(all.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(calls[1]!.url).toContain('page=2');
    expect(calls[1]!.url).toContain('per_page=200');
  });

  it('pages CRM lists with the next page token', async () => {
    const { client, calls } = make(
      [
        () => reply(200, { data: [{ id: 'a' }], info: { more_records: true, next_page_token: 'tok2' } }),
        () => reply(200, { data: [{ id: 'b' }], info: { more_records: false } }),
      ],
      { baseUrl: 'https://www.zohoapis.in/crm/v8', orgParam: null },
    );
    const out: string[] = [];
    for await (const page of client.crmPages<{ id: string }>('/Accounts', { fields: 'Account_Name' })) out.push(...page.map((p) => p.id));
    expect(out).toEqual(['a', 'b']);
    expect(calls[1]!.url).toContain('page_token=tok2');
  });
});

describe('RateLimiter', () => {
  it('waits when a key has used its minute', async () => {
    let t = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter(2, () => t, async (ms) => {
      waits.push(ms);
      t += ms;
    });
    await limiter.take('org');
    await limiter.take('org');
    await limiter.take('org');
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThanOrEqual(60_000);
    await limiter.take('other');
    expect(waits).toHaveLength(1);
  });
});
