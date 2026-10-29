import { describe, expect, it } from 'vitest';
import { decryptTotpSecret, encryptTotpSecret } from './secret-box';

describe('TOTP secret box', () => {
  it('round-trips for the same person', () => {
    const enc = encryptTotpSecret('p1', 'GEZDGNBVGY3TQOJQ');
    expect(enc.startsWith('t1:')).toBe(true);
    expect(enc).not.toContain('GEZDGNBVGY3TQOJQ');
    expect(decryptTotpSecret('p1', enc)).toBe('GEZDGNBVGY3TQOJQ');
  });

  it('will not open a secret copied onto another person', () => {
    const enc = encryptTotpSecret('p1', 'GEZDGNBVGY3TQOJQ');
    expect(decryptTotpSecret('p2', enc)).toBeNull();
  });

  it('returns null for missing or malformed values', () => {
    expect(decryptTotpSecret('p1', null)).toBeNull();
    expect(decryptTotpSecret('p1', 'v1:a:b:c')).toBeNull();
    expect(decryptTotpSecret('p1', 't1:AAAA:AAAA:AAAA')).toBeNull();
  });
});
