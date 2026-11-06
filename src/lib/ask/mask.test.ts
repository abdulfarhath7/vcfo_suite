import { describe, expect, it } from 'vitest';
import { holdsPortalSecret, maskIdentityNumbers, tokeniseIdentityNumbers } from './mask';

describe('maskIdentityNumbers', () => {
  it('leaves a record id whole, though parts of one look like a passport or an Aadhaar', () => {
    const id = 'a1234567-2345-6789-0123-123456789012';
    const masked = maskIdentityNumbers(`task ${id} and PAN ABCDE1234F`);
    expect(masked).toContain(id);
    expect(masked).not.toContain('ABCDE1234F');
  });

  it('masks PAN, Aadhaar, passport and DIN, keeping the last four', () => {
    expect(maskIdentityNumbers('PAN ABCDE1234F')).toBe('PAN XXXXXX234F');
    expect(maskIdentityNumbers('Aadhaar 2345 6789 0123')).toBe('Aadhaar XXXXXXXX0123');
    expect(maskIdentityNumbers('Passport J8369854')).toBe('Passport XXXX9854');
    expect(maskIdentityNumbers('DIN: 01234567')).toBe('DIN: XXXX4567');
  });

  it('catches a PAN or passport typed in lower case', () => {
    expect(maskIdentityNumbers('pan abcde1234f')).toBe('pan XXXXXX234f');
    expect(maskIdentityNumbers('passport j8369854')).toBe('passport XXXX9854');
  });

  it('leaves public registry numbers and ordinary text alone', () => {
    const text = 'GSTIN 22AAAAA0000A1Z5, CIN U74999TG2020PTC123456, 12 directors on 01-04-2026, 12345678';
    expect(maskIdentityNumbers(text)).toBe(text);
  });
});

describe('portal logins and one-time codes', () => {
  it('hides each kind of secret, wherever the text goes', () => {
    for (const [text, kept] of [
      ['MCA password: Secret@123', 'Secret@123'],
      ['the password is Abc12345', 'Abc12345'],
      ['pwd=hunter2', 'hunter2'],
      ['OTP 482913', '482913'],
      ['the otp is 482913', '482913'],
      ['one-time code: 9921', '9921'],
      ['DSC PIN 4321', '4321'],
      ['dsc token pin: 8765', '8765'],
      ['portal token: a1b2c3d4e5f6g7h8i9', 'a1b2c3d4e5f6g7h8i9'],
      ['Bearer abcdefghijklmnop12345', 'abcdefghijklmnop12345'],
      ['eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2', 'eyJhbGciOiJIUzI1'],
    ] as const) {
      expect(holdsPortalSecret(text), text).toBe(true);
      expect(maskIdentityNumbers(text), text).not.toContain(kept);
      expect(tokeniseIdentityNumbers(text).text, text).not.toContain(kept);
    }
  });

  it('leaves questions about them and postal codes alone', () => {
    for (const text of ['Where do I enter the OTP?', 'the password is required', 'The OTP is sent to the director', 'PIN 500081', 'PIN: 500081, Hyderabad', 'what is a DSC token?', 'the secret ballot of 2026', 'prepare the filing run for GSTR-3B']) {
      expect(holdsPortalSecret(text), text).toBe(false);
      expect(maskIdentityNumbers(text), text).toBe(text);
    }
  });
});
