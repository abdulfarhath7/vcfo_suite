// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decode, encode } from '@auth/core/jwt';
import { authSecrets } from './secrets';

describe('authSecrets', () => {
  it('lists the current secret first and the previous one second', () => {
    expect(authSecrets({ AUTH_SECRET: 'new', AUTH_SECRET_PREVIOUS: 'old' })).toEqual(['new', 'old']);
  });

  it('uses NEXTAUTH_SECRET only when AUTH_SECRET is empty', () => {
    expect(authSecrets({ NEXTAUTH_SECRET: 'legacy' })).toEqual(['legacy']);
    expect(authSecrets({ AUTH_SECRET: 'a', NEXTAUTH_SECRET: 'legacy' })).toEqual(['a']);
  });

  it('never signs with the previous secret alone and drops a duplicate', () => {
    expect(authSecrets({ AUTH_SECRET_PREVIOUS: 'old' })).toEqual([]);
    expect(authSecrets({ AUTH_SECRET: 'same', AUTH_SECRET_PREVIOUS: 'same' })).toEqual(['same']);
  });

  it('keeps a token signed with the previous secret valid after a rotation', async () => {
    const salt = 'authjs.session-token';
    const old = await encode({ token: { sub: 'u1' }, secret: 'secret-a', salt });
    const rotated = authSecrets({ AUTH_SECRET: 'secret-b', AUTH_SECRET_PREVIOUS: 'secret-a' });
    expect((await decode({ token: old, secret: rotated, salt }))?.sub).toBe('u1');

    // A new token is signed with the current secret only.
    const fresh = await encode({ token: { sub: 'u1' }, secret: rotated, salt });
    expect((await decode({ token: fresh, secret: ['secret-b'], salt }))?.sub).toBe('u1');
    await expect(decode({ token: fresh, secret: ['secret-a'], salt })).rejects.toThrow();
  });
});
