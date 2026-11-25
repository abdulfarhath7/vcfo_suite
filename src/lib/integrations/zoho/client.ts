/**
 * A small fetch client for Zoho's REST APIs (no SDK). It asks the caller for an access token, so
 * refresh on demand lives with the connection (src/db/repositories/integrations/tokens.ts); it
 * retries once with a fresh token on 401, backs off on 429 (Retry-After or 1 s, 2 s, 4 s, 8 s),
 * keeps each organisation under 100 calls a minute, and pages Books-style and CRM-style lists.
 * Nothing here logs a token or a response body.
 */

export type ZohoOrgParam = 'query' | 'header' | null;

export interface ZohoClientOptions {
  baseUrl: string;
  /** Sent as `organization_id` (Books, Payroll) or as a header (Invoice); null for CRM and People. */
  orgId?: string | null;
  orgParam?: ZohoOrgParam;
  /** The header Invoice wants the org in. */
  orgHeader?: string;
  /** Returns a valid access token; `force` asks for a refresh even when the stored one looks fresh. */
  getAccessToken: (force?: boolean) => Promise<string>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  limiter?: RateLimiter;
  /** Retries on 429 before giving up. */
  maxRetries?: number;
}

export class ZohoApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string | number,
  ) {
    super(message);
    this.name = 'ZohoApiError';
  }
}

/**
 * A sliding one-minute window per key. Zoho Books allows 100 requests a minute per organisation;
 * the same cap is used for every app, which is under each app's own limit.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(
    readonly perMinute = 100,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {}

  /** Waits until one more call fits for `key`, then counts it. */
  async take(key: string): Promise<void> {
    for (;;) {
      const t = this.now();
      const list = (this.hits.get(key) ?? []).filter((h) => t - h < 60_000);
      if (list.length < this.perMinute) {
        list.push(t);
        this.hits.set(key, list);
        return;
      }
      this.hits.set(key, list);
      await this.sleep(60_000 - (t - list[0]!) + 5);
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** One limiter for the whole process, so parallel jobs on one org share the budget. */
export const sharedLimiter = new RateLimiter();

type Query = Record<string, string | number | boolean | undefined | null>;

export class ZohoClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly limiter: RateLimiter;
  private readonly maxRetries: number;

  constructor(private readonly opts: ZohoClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? defaultSleep;
    this.limiter = opts.limiter ?? sharedLimiter;
    this.maxRetries = opts.maxRetries ?? 4;
  }

  private url(path: string, query: Query = {}): string {
    const u = new URL(`${this.opts.baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`);
    if (this.opts.orgId && this.opts.orgParam === 'query') u.searchParams.set('organization_id', this.opts.orgId);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    return u.toString();
  }

  /** GET a JSON body. 204 reads as `{}`. */
  async get<T = Record<string, unknown>>(path: string, query: Query = {}): Promise<T> {
    const url = this.url(path, query);
    const limitKey = `${this.opts.baseUrl}|${this.opts.orgId ?? '-'}`;
    let refreshed = false;
    let forceRefresh = false;
    let attempt = 0;
    for (;;) {
      await this.limiter.take(limitKey);
      const token = await this.opts.getAccessToken(forceRefresh);
      forceRefresh = false;
      const headers: Record<string, string> = { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json' };
      if (this.opts.orgId && this.opts.orgParam === 'header') headers[this.opts.orgHeader ?? 'X-com-zoho-invoice-organizationid'] = this.opts.orgId;
      const res = await this.fetchImpl(url, { headers });
      if (res.status === 401 && !refreshed) {
        // The stored token may have been revoked or expired early: refresh once and try again.
        refreshed = true;
        forceRefresh = true;
        continue;
      }
      if (res.status === 429 && attempt < this.maxRetries) {
        const after = Number(res.headers.get('retry-after'));
        await this.sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * 2 ** attempt);
        attempt += 1;
        continue;
      }
      if (res.status === 204) return {} as T;
      const body = (await res.json().catch(() => null)) as (Record<string, unknown> & { code?: unknown; message?: unknown }) | null;
      if (!res.ok) {
        const msg = typeof body?.message === 'string' ? body.message : `zoho_${res.status}`;
        throw new ZohoApiError(msg.slice(0, 200), res.status, (body?.code as string | number | undefined) ?? undefined);
      }
      // Books, Invoice and Payroll answer `code: 0` on success; anything else is an error in a 200.
      if (body && typeof body.code === 'number' && body.code !== 0) {
        throw new ZohoApiError(String(body.message ?? `zoho_code_${body.code}`).slice(0, 200), res.status, body.code);
      }
      return (body ?? {}) as T;
    }
  }

  /**
   * Books / Invoice / Payroll list paging: `page`, `per_page` (200) and
   * `page_context.has_more_page`. `maxPages` guards a runaway loop.
   */
  async *pages<T>(path: string, key: string, query: Query = {}, maxPages = 200): AsyncGenerator<T[]> {
    for (let page = 1; page <= maxPages; page++) {
      const body = await this.get<Record<string, unknown>>(path, { ...query, page, per_page: 200 });
      const items = (body[key] as T[] | undefined) ?? [];
      yield items;
      const ctx = body.page_context as { has_more_page?: boolean } | undefined;
      if (!ctx?.has_more_page || items.length === 0) return;
    }
  }

  async all<T>(path: string, key: string, query: Query = {}, maxPages = 200): Promise<T[]> {
    const out: T[] = [];
    for await (const items of this.pages<T>(path, key, query, maxPages)) out.push(...items);
    return out;
  }

  /** CRM paging: `info.more_records` and `info.next_page_token` (pages past 2,000 records need the token). */
  async *crmPages<T>(path: string, query: Query = {}, maxPages = 200): AsyncGenerator<T[]> {
    let pageToken: string | undefined;
    for (let page = 1; page <= maxPages; page++) {
      const body = await this.get<{ data?: T[]; info?: { more_records?: boolean; next_page_token?: string } }>(path, {
        ...query,
        per_page: 200,
        ...(pageToken ? { page_token: pageToken } : { page }),
      });
      const items = body.data ?? [];
      yield items;
      if (!body.info?.more_records || items.length === 0) return;
      pageToken = body.info.next_page_token || undefined;
    }
  }
}
