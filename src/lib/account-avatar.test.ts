import { describe, expect, it } from 'vitest';
import {
  ownAvatarSrc,
  profileAvatarObjectKey,
  sniffImageContentType,
} from '@/lib/account-avatar';

describe('profileAvatarObjectKey', () => {
  it('namespaces by user id', () => {
    expect(profileAvatarObjectKey('a1b2-c3')).toBe('avatars/a1b2-c3/photo');
  });

  it('strips unsafe characters from the id', () => {
    expect(profileAvatarObjectKey('../etc/passwd')).toBe('avatars/etcpasswd/photo');
  });
});

describe('ownAvatarSrc', () => {
  it('adds a cache-busting query when a version is present', () => {
    expect(ownAvatarSrc(42)).toBe('/api/account/avatar?v=42');
    expect(ownAvatarSrc(new Date(1000))).toBe('/api/account/avatar?v=1000');
  });

  it('omits the query when there is no version', () => {
    expect(ownAvatarSrc()).toBe('/api/account/avatar');
    expect(ownAvatarSrc(null)).toBe('/api/account/avatar');
  });
});

describe('sniffImageContentType', () => {
  it('detects jpeg / png / gif / webp', () => {
    expect(sniffImageContentType(Uint8Array.of(0xff, 0xd8, 0xff, 0x00))).toBe('image/jpeg');
    expect(
      sniffImageContentType(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe('image/png');
    expect(sniffImageContentType(Uint8Array.of(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe(
      'image/gif',
    );
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniffImageContentType(webp)).toBe('image/webp');
  });

  it('rejects non-images', () => {
    expect(sniffImageContentType(Uint8Array.of(0x00, 0x01))).toBeNull();
    expect(sniffImageContentType(new Uint8Array())).toBeNull();
  });
});
