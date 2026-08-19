import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from '@/lib/site-url';

describe('resolveSiteUrl', () => {
  it('prefers the live browser origin over a stale public env URL', () => {
    expect(
      resolveSiteUrl(
        'https://old-random-words.trycloudflare.com',
        'https://new-random-words.trycloudflare.com',
      ),
    ).toBe('https://new-random-words.trycloudflare.com');
  });

  it('prefers the live origin even when env is localhost', () => {
    expect(resolveSiteUrl('http://localhost:3000', 'https://app.example.com')).toBe(
      'https://app.example.com',
    );
  });

  it('uses env on the server when there is no window origin', () => {
    expect(resolveSiteUrl('https://app.example.com', undefined)).toBe('https://app.example.com');
  });

  it('falls back to localhost when env and window are missing', () => {
    expect(resolveSiteUrl(undefined, undefined)).toBe('http://localhost:3000');
  });
});
