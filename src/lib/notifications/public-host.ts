import 'server-only';

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
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
 * Refuses a URL whose host is, or resolves to, any address that is not public. Every request and
 * every redirect hop calls this, so a listed name that is repointed inside the network is not read.
 */
export async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw new Error('host_not_public');
}

/** An official RSS or Atom feed, following at most three redirects, each one checked again. */
export async function fetchOfficialFeedXml(feedUrl: string): Promise<string> {
  let current = assertSafeFeedUrl(feedUrl);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(current);
    const res = await fetch(current.href, {
      redirect: 'manual',
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.4',
        'User-Agent': 'VCFO-Suite/1.0 (firm announcement feeds)',
      },
      signal: AbortSignal.timeout(12_000),
    });
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
