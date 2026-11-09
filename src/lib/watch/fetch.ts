import 'server-only';

import { createHash } from 'node:crypto';
import { assertSafeFeedUrl } from '@/lib/notifications/announcements';
import { publicFetch } from '@/lib/notifications/public-host';
import { ALLOW_ALL, DENY_ALL, parseRobots, robotsAllows, type RobotsRules } from './robots';

/**
 * The only way Watch reads the web. Official allowlisted hosts over HTTPS on the default port, at
 * public addresses only, our real name in the user agent, robots rules honoured, one request at a
 * time per host with a gap between them, and a size limit. A 403, a robots refusal or a crawl delay
 * too long to keep is `blocked`: the caller stops and the source goes to manual intake. There is no retry, no rotation and no disguise, by the owner's rule.
 */
export const WATCH_USER_AGENT = 'VCFO-Suite/1.0 (official updates reader; +https://sbcllp.in)';

const TIMEOUT_MS = 25_000;
const MIN_GAP_MS = 2_000;
const ROBOTS_TTL_MS = 24 * 3_600_000;
const MAX_HOPS = 4;
/** RFC 9309 asks a crawler to follow at least five redirects to a robots file. */
const MAX_ROBOTS_REDIRECTS = 5;
/** A site asking for a longer wait than this between requests is left to manual intake, never read faster. */
const MAX_CRAWL_DELAY_MS = 60_000;
export const MAX_PAGE_BYTES = 3 * 1024 * 1024;
export const MAX_PDF_BYTES = 15 * 1024 * 1024;

export class WatchBlockedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'WatchBlockedError';
  }
}

export type WatchFetch =
  | { status: 'not_modified'; finalUrl: string }
  | {
      status: 'ok';
      finalUrl: string;
      body: Buffer;
      contentType: string;
      etag: string | null;
      lastModified: string | null;
      hash: string;
    };

export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Per-host queue: a request starts only after the last one on that host ended and the gap passed. */
const hostTurns = new Map<string, { tail: Promise<unknown>; lastEnd: number }>();

async function onHostTurn<T>(host: string, gapMs: number, run: () => Promise<T>): Promise<T> {
  const turn = hostTurns.get(host) ?? { tail: Promise.resolve(), lastEnd: 0 };
  hostTurns.set(host, turn);
  const result = turn.tail.then(async () => {
    const wait = turn.lastEnd + gapMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      return await run();
    } finally {
      turn.lastEnd = Date.now();
    }
  });
  turn.tail = result.catch(() => undefined);
  return result;
}

async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error('too_large');
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('too_large');
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}

function request(url: URL, headers: Record<string, string> = {}): Promise<Response> {
  return publicFetch(url, { 'User-Agent': WATCH_USER_AGENT, ...headers }, TIMEOUT_MS);
}

const robotsCache = new Map<string, { rules: RobotsRules; at: number }>();

/** Tests start each case with an empty robots cache and no host history. */
export function resetWatchFetchForTests(): void {
  robotsCache.clear();
  hostTurns.clear();
}

async function robotsFor(url: URL): Promise<RobotsRules> {
  const cached = robotsCache.get(url.hostname);
  if (cached && Date.now() - cached.at < ROBOTS_TTL_MS) return cached.rules;
  const rules = await onHostTurn(url.hostname, MIN_GAP_MS, async () => {
    let current = new URL('/robots.txt', url);
    for (let redirects = 0; ; redirects++) {
      const res = await request(current, { Accept: 'text/plain' });
      if (res.status >= 300 && res.status < 400) {
        // Redirects are followed to any path, as RFC 9309 says. One with no target, a sixth one, or one
        // to an address Watch never reads leaves the rules unread, and unread rules allow nothing.
        const location = res.headers.get('location');
        if (!location || redirects === MAX_ROBOTS_REDIRECTS) return DENY_ALL;
        try {
          current = assertSafeFeedUrl(new URL(location, current).href);
        } catch {
          return DENY_ALL;
        }
        continue;
      }
      if (res.ok) return parseRobots((await readCapped(res, 512 * 1024)).toString('utf8'));
      if (res.status === 401 || res.status === 403) return DENY_ALL;
      // A 429 asks us to slow down, which is not "no robots file", so this check fails and runs later.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return ALLOW_ALL;
      throw new Error(`robots_http_${res.status}`);
    }
  });
  robotsCache.set(url.hostname, { rules, at: Date.now() });
  return rules;
}

/**
 * GET one official URL. Every redirect hop passes the same host, address and robots checks. With `etag` or
 * `lastModified` it asks conditionally and a 304 returns `not_modified`.
 */
export async function watchFetch(
  rawUrl: string,
  opts: { etag?: string | null; lastModified?: string | null; maxBytes?: number } = {},
): Promise<WatchFetch> {
  let current = assertSafeFeedUrl(rawUrl);
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const robots = await robotsFor(current);
    if (!robotsAllows(robots, current.pathname + current.search)) throw new WatchBlockedError('robots_disallow');
    if ((robots.crawlDelayMs ?? 0) > MAX_CRAWL_DELAY_MS) throw new WatchBlockedError('robots_crawl_delay');
    const gap = Math.max(MIN_GAP_MS, robots.crawlDelayMs ?? 0);
    const target = current;
    const outcome = await onHostTurn(target.hostname, gap, async () => {
      const res = await request(target, {
        Accept: '*/*',
        ...(opts.etag ? { 'If-None-Match': opts.etag } : {}),
        ...(opts.lastModified ? { 'If-Modified-Since': opts.lastModified } : {}),
      });
      if (res.status === 304) return { status: 'not_modified' as const, finalUrl: target.href };
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) throw new Error('bad_redirect');
        return { next: new URL(location, target).href };
      }
      if (res.status === 401 || res.status === 403) throw new WatchBlockedError(`http_${res.status}`);
      if (!res.ok) throw new Error(`http_${res.status}`);
      const body = await readCapped(res, opts.maxBytes ?? MAX_PAGE_BYTES);
      return {
        status: 'ok' as const,
        finalUrl: target.href,
        body,
        contentType: (res.headers.get('content-type') ?? '').toLowerCase(),
        etag: res.headers.get('etag'),
        lastModified: res.headers.get('last-modified'),
        hash: sha256(body),
      };
    });
    if ('next' in outcome) {
      current = assertSafeFeedUrl(outcome.next);
      continue;
    }
    return outcome;
  }
  throw new Error('too_many_redirects');
}
