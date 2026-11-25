// @vitest-environment node
// The route runs on the server, where siteUrl() reads SITE_URL; in jsdom it would prefer the
// browser's own origin and the fallback could not be tested at all.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { falconDomain } from './provider';

const base = { ...process.env } as NodeJS.ProcessEnv;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('falconDomain', () => {
  it('uses FALCON_API_DOMAIN when it is set', () => {
    expect(falconDomain({ ...base, FALCON_API_DOMAIN: 'sbctrack.in' })).toBe('sbctrack.in');
  });

  it('tolerates a pasted URL, because that is what people paste', () => {
    expect(falconDomain({ ...base, FALCON_API_DOMAIN: 'https://app.sbctrack.in/' })).toBe('app.sbctrack.in');
    expect(falconDomain({ ...base, FALCON_API_DOMAIN: ' http://sbctrack.in ' })).toBe('sbctrack.in');
  });

  it('falls back to the host the Suite runs on, so nothing has to be configured', () => {
    vi.stubEnv('SITE_URL', 'https://app.sbctrack.in');
    expect(falconDomain({ ...base, FALCON_API_DOMAIN: undefined })).toBe('app.sbctrack.in');
  });

  it('falls back to localhost in development rather than failing', () => {
    vi.stubEnv('SITE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(falconDomain({ ...base, FALCON_API_DOMAIN: '' })).toBe('localhost');
  });
});
