import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config.mjs';

const require = createRequire(import.meta.url);
const { isCsrfOriginAllowed } = require('next/dist/server/app-render/csrf-protection.js') as {
  isCsrfOriginAllowed: (originDomain: string, allowedOrigins?: string[]) => boolean;
};

const allowed = (nextConfig as { allowedDevOrigins?: string[] }).allowedDevOrigins ?? [];

describe('allowedDevOrigins (Cloudflare quick tunnels)', () => {
  it('includes trycloudflare wildcards', () => {
    expect(allowed).toContain('*.trycloudflare.com');
    expect(allowed).toContain('**.trycloudflare.com');
  });

  it('allows a rotating trycloudflare hostname via Next 16 isCsrfOriginAllowed', () => {
    expect(
      isCsrfOriginAllowed('median-wireless-copying-wellness.trycloudflare.com', allowed),
    ).toBe(true);
  });

  it('does not allow an unrelated host', () => {
    expect(isCsrfOriginAllowed('evil.example.com', allowed)).toBe(false);
  });
});
