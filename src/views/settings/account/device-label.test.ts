import { describe, expect, it } from 'vitest';
import { describeUserAgent, lastSeenLabel, shortDate } from './device-label';

describe('describeUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Chrome on Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0', 'Edge on Windows'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Safari on iPhone'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', 'Chrome on Android'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox on Mac'],
    ['curl/8.0', 'Unknown device'],
    ['', 'Unknown device'],
  ])('%s', (ua, label) => {
    expect(describeUserAgent(ua)).toBe(label);
  });
});

describe('dates', () => {
  const now = new Date('2026-10-29T06:30:00Z');

  it('writes plain short dates in India time', () => {
    expect(shortDate('2026-10-14T20:00:00Z', now)).toBe('15 Oct');
    expect(shortDate('2025-12-01T06:00:00Z', now)).toBe('1 Dec 2025');
  });

  it('reads recent activity as minutes and hours', () => {
    expect(lastSeenLabel('2026-10-29T06:25:00Z', now)).toBe('Active now');
    expect(lastSeenLabel('2026-10-29T06:00:00Z', now)).toBe('30 min ago');
    expect(lastSeenLabel('2026-10-29T01:30:00Z', now)).toBe('5 h ago');
    expect(lastSeenLabel('2026-10-20T01:30:00Z', now)).toBe('20 Oct');
  });
});
