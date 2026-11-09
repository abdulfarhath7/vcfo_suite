import 'server-only';

import { lookup } from 'node:dns/promises';
import { get, type RequestOptions } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { Readable } from 'node:stream';
import { assertSafeFeedUrl } from './announcements';

/**
 * Addresses a server-side fetch must never reach: this machine, private networks, link-local (where
 * the cloud metadata service sits), carrier-grade NAT, documentation, benchmark and reserved ranges,
 * and multicast. An IPv4-mapped IPv6 address is checked as the IPv4 address it carries, which the
 * block list does by itself. Other IPv6 forms with an IPv4 address inside (NAT64, 6to4, Teredo) are
 * refused whole, because an official site has no reason to publish one.
 */
const NOT_PUBLIC = new BlockList();
for (const [network, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) NOT_PUBLIC.addSubnet(network, bits, 'ipv4');
for (const [network, bits] of [
  ['::', 127], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 32], ['2001:db8::', 32],
  ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
] as const) NOT_PUBLIC.addSubnet(network, bits, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family !== 0 && !NOT_PUBLIC.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * The socket's own name lookup: every address the name resolves to must be public, and the socket
 * connects to the addresses checked here. A check made before the request would let the connection
 * resolve the name again, so a name repointed inside the network between the two (DNS rebinding)
 * would be read.
 */
export const publicLookup: RequestOptions['lookup'] = (hostname, options, callback) => {
  lookup(hostname, { all: true, verbatim: true }).then(
    (entries) => {
      if (entries.length === 0 || !entries.every((entry) => isPublicAddress(entry.address))) return callback(new Error('host_not_public'), '', 4);
      if (options.all) return (callback as unknown as (err: null, list: typeof entries) => void)(null, entries);
      callback(null, entries[0]!.address, entries[0]!.family);
    },
    (err: NodeJS.ErrnoException) => callback(err, '', 4),
  );
};

/** Bodies a Response refuses to carry. */
const NULL_BODY = new Set([204, 205, 304]);

/**
 * GET over HTTPS at a public address only, without following redirects. An address written in the URL
 * is checked here, since a socket skips the lookup for one; a name is checked by `publicLookup`.
 */
export function publicFetch(url: URL, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) return Promise.reject(new Error('host_not_public'));
  return new Promise((resolve, reject) => {
    get(url, { headers, lookup: publicLookup, agent: false, signal: AbortSignal.timeout(timeoutMs) }, (res) => {
      try {
        const status = res.statusCode ?? 0;
        const pairs: [string, string][] = [];
        for (let i = 0; i < res.rawHeaders.length; i += 2) pairs.push([res.rawHeaders[i]!, res.rawHeaders[i + 1]!]);
        const body = NULL_BODY.has(status) ? null : (Readable.toWeb(res) as ReadableStream<Uint8Array>);
        resolve(new Response(body, { status, headers: pairs }));
      } catch (err) {
        res.destroy();
        reject(err);
      }
    }).on('error', reject);
  });
}

/** An official RSS or Atom feed, following at most three redirects, each one checked again. */
export async function fetchOfficialFeedXml(feedUrl: string): Promise<string> {
  let current = assertSafeFeedUrl(feedUrl);
  for (let hop = 0; hop < 4; hop++) {
    const res = await publicFetch(
      current,
      {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.4',
        'User-Agent': 'VCFO-Suite/1.0 (firm announcement feeds)',
      },
      12_000,
    );
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error('feed_redirect_invalid');
      current = assertSafeFeedUrl(new URL(location, current).href);
      continue;
    }
    if (!res.ok) throw new Error(`feed_http_${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 512 * 1024) throw new Error('feed_too_large');
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buf).trim();
    if (!text.includes('<')) throw new Error('feed_not_xml');
    return text;
  }
  throw new Error('feed_too_many_redirects');
}
