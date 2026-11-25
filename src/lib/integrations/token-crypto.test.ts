import { afterEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './token-crypto';
import * as outlook from '@/lib/outlook/token-crypto';

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

describe('integration token crypto', () => {
  it('round-trips and is the same helper Outlook uses', () => {
    process.env.AUTH_SECRET = 'one';
    const blob = encryptSecret('refresh-token');
    expect(blob.startsWith('v1.')).toBe(true);
    expect(outlook.decryptSecret(blob)).toBe('refresh-token');
    expect(decryptSecret(outlook.encryptSecret('x'))).toBe('x');
  });

  it('opens a blob sealed before a rotation with AUTH_SECRET_PREVIOUS', () => {
    process.env.AUTH_SECRET = 'old';
    const blob = encryptSecret('tok');
    process.env.AUTH_SECRET = 'new';
    process.env.AUTH_SECRET_PREVIOUS = 'old';
    expect(decryptSecret(blob)).toBe('tok');
    delete process.env.AUTH_SECRET_PREVIOUS;
    expect(() => decryptSecret(blob)).toThrow();
  });
});
