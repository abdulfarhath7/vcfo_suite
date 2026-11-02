import { describe, expect, it } from 'vitest';
import { devDirectEmail, devDirectEmails, devDirectPick, safeNextPath } from './dev-direct';

const DEV = { NODE_ENV: 'development', DEV_DIRECT_LOGIN_EMAIL: 'prithish@sbcllp.in, Pranay.K@sbcllp.in,bhavana@sbcllp.in' };

describe('devDirectEmails / devDirectPick', () => {
  it('reads a comma-separated list, normalised and without repeats', () => {
    expect(devDirectEmails({ ...DEV, DEV_DIRECT_LOGIN_EMAIL: DEV.DEV_DIRECT_LOGIN_EMAIL + ',prithish@sbcllp.in' })).toEqual([
      'prithish@sbcllp.in',
      'pranay.k@sbcllp.in',
      'bhavana@sbcllp.in',
    ]);
  });

  it('signs in as a requested account only when it is on the list', () => {
    expect(devDirectPick('PRANAY.K@sbcllp.in', DEV)).toBe('pranay.k@sbcllp.in');
    expect(devDirectPick('someone@else.com', DEV)).toBeNull();
  });

  it('with no request, picks the account only when exactly one is listed', () => {
    expect(devDirectPick(null, DEV)).toBeNull();
    expect(devDirectPick(null, { NODE_ENV: 'development', DEV_DIRECT_LOGIN_EMAIL: 'prithish@sbcllp.in' })).toBe('prithish@sbcllp.in');
  });

  it('is always off in production', () => {
    expect(devDirectEmails({ ...DEV, NODE_ENV: 'production' })).toEqual([]);
    expect(devDirectPick('prithish@sbcllp.in', { ...DEV, NODE_ENV: 'production' })).toBeNull();
  });
});

describe('devDirectEmail', () => {
  it('is off when the variable is not set', () => {
    expect(devDirectEmail({ NODE_ENV: 'development' })).toBeNull();
  });

  it('returns the configured email in development, normalised', () => {
    expect(devDirectEmail({ NODE_ENV: 'development', DEV_DIRECT_LOGIN_EMAIL: '  Prithish@SBCLLP.in ' })).toBe('prithish@sbcllp.in');
  });

  it('is always off in production, even when the variable is set', () => {
    expect(devDirectEmail({ NODE_ENV: 'production', DEV_DIRECT_LOGIN_EMAIL: 'prithish@sbcllp.in' })).toBeNull();
  });

  it('ignores a value that is not an email', () => {
    expect(devDirectEmail({ NODE_ENV: 'development', DEV_DIRECT_LOGIN_EMAIL: 'yes' })).toBeNull();
  });
});

describe('safeNextPath', () => {
  it('keeps in-app paths', () => {
    expect(safeNextPath('/app/client/incorporation')).toBe('/app/client/incorporation');
  });

  it('drops anything outside the app or pointing at another site', () => {
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example/app/x')).toBeNull();
    expect(safeNextPath('/login')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
