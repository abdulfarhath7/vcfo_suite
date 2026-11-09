// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertSafeHttpsUrl } from './announcements';
import { connected, respondWith } from './__tests__/fake-https';
import { fetchOfficialFeedXml, isPublicAddress, publicLookup } from './public-host';

const lookup = vi.hoisted(() => vi.fn());
vi.mock('node:dns/promises', () => ({ lookup: (...args: unknown[]) => lookup(...args) }));
vi.mock('node:https', () => import('./__tests__/fake-https'));

const fetchMock = vi.fn();
beforeEach(() => {
  lookup.mockReset().mockResolvedValue([{ address: '164.100.78.1', family: 4 }]);
  fetchMock.mockReset();
  respondWith(fetchMock);
});

describe('isPublicAddress', () => {
  it('refuses loopback, private, link-local, shared, multicast and metadata addresses in both families', () => {
    for (const address of ['127.0.0.1', '10.4.5.6', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.100.100.200', '0.0.0.0', '224.0.0.251', '255.255.255.255', '::', '::1', 'fd00:ec2::254', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:a9fe:a9fe', '64:ff9b::a00:1', '2002:a00:1::1', 'not-an-address']) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it('admits public addresses, mapped ones included', () => {
    for (const address of ['164.100.78.1', '8.8.8.8', '2404:6800:4009::200e', '::ffff:8.8.8.8']) expect(isPublicAddress(address), address).toBe(true);
  });
});

describe('assertSafeHttpsUrl', () => {
  it('takes the default HTTPS port only', () => {
    expect(() => assertSafeHttpsUrl('https://icsi.edu:8443/a', 'feed')).toThrow('invalid_feed_url');
    expect(() => assertSafeHttpsUrl('https://mca.gov.in:444/a', 'link')).toThrow('invalid_link');
    expect(assertSafeHttpsUrl('https://mca.gov.in:443/a', 'link').href).toBe('https://mca.gov.in/a');
  });
});

describe('fetchOfficialFeedXml', () => {
  it('reads nothing from a listed name that resolves inside the network', async () => {
    lookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    await expect(fetchOfficialFeedXml('https://old.rbi.org.in/feed.xml')).rejects.toThrow('host_not_public');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the address of every redirect hop before following it', async () => {
    lookup.mockImplementation(async (host: string) => [{ address: host === 'inside.rbi.org.in' ? '10.0.0.9' : '164.100.78.1', family: 4 }]);
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://inside.rbi.org.in/feed.xml' } }));
    await expect(fetchOfficialFeedXml('https://www.rbi.org.in/feed.xml')).rejects.toThrow('host_not_public');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads a feed on a public address', async () => {
    fetchMock.mockResolvedValue(new Response('<rss></rss>'));
    await expect(fetchOfficialFeedXml('https://www.rbi.org.in/feed.xml')).resolves.toBe('<rss></rss>');
  });

  it('resolves the name once and connects to the address it checked, so a second answer cannot repoint it', async () => {
    lookup.mockResolvedValueOnce([{ address: '164.100.78.1', family: 4 }]).mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    fetchMock.mockResolvedValue(new Response('<rss></rss>'));
    await expect(fetchOfficialFeedXml('https://www.rbi.org.in/feed.xml')).resolves.toBe('<rss></rss>');
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(connected).toEqual(['164.100.78.1']);
  });
});

describe('publicLookup', () => {
  const ask = (all: boolean) =>
    new Promise<unknown[]>((resolve) => publicLookup!('www.rbi.org.in', { all } as never, (...args: unknown[]) => resolve(args)));

  it('hands a socket asking for one address the checked address, and refuses a name with any inside address', async () => {
    expect(await ask(false)).toEqual([null, '164.100.78.1', 4]);
    lookup.mockResolvedValue([{ address: '164.100.78.1', family: 4 }, { address: '10.0.0.9', family: 4 }]);
    expect(((await ask(true))[0] as Error).message).toBe('host_not_public');
  });
});
