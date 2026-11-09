import { describe, expect, it } from 'vitest';
import { holdsPortalSecret, maskIdentityNumbers, safeError, tokeniseIdentityNumbers } from './mask';

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

  it('masks a number an underscore joins to a word, as in a file name', () => {
    for (const [text, kept] of [
      ['PAN_ABCDE1234F.pdf', 'ABCDE1234F'],
      ['ABCDE1234F_pan.pdf', 'ABCDE1234F'],
      ['Aadhaar_234567890123.pdf', '234567890123'],
      ['{"fileName":"PAN_ABCDE1234F.pdf"}', 'ABCDE1234F'],
      ['passport_J8369854.png', 'J8369854'],
      ['DIN_01234567', '01234567'],
    ] as const) {
      expect(maskIdentityNumbers(text), text).not.toContain(kept);
      expect(tokeniseIdentityNumbers(text).text, text).not.toContain(kept);
    }
    expect(maskIdentityNumbers('GSTIN_22AAAAA0000A1Z5.pdf')).toBe('GSTIN_22AAAAA0000A1Z5.pdf');
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

  it('catches the other ways people write a password or a code', () => {
    for (const [text, kept] of [
      ['The MCA password for this client is Abc@1234', 'Abc@1234'],
      ['The password for MCA V3 portal: Abc@1234', 'Abc@1234'],
      ['Login: ravi / Pass: Abc@1234', 'Abc@1234'],
      ['pass: Abc@1234', 'Abc@1234'],
      ['password - Abc@1234', 'Abc@1234'],
      ['MCA login ravi, pw Abc@1234', 'Abc@1234'],
      ['my password is Secretword', 'Secretword'],
      ['OTP: AB12CD', 'AB12CD'],
    ] as const) {
      expect(holdsPortalSecret(text), text).toBe(true);
      expect(maskIdentityNumbers(text), text).not.toContain(kept);
    }
  });

  it('catches the usual English and Hinglish phrasings', () => {
    for (const [text, kept] of [
      ['password is: Abc@1234', 'Abc@1234'],
      ['password -> Abc@1234', 'Abc@1234'],
      ['pass is Abc@1234', 'Abc@1234'],
      ['pass word: Abc@1234', 'Abc@1234'],
      ['password hai Abc@1234', 'Abc@1234'],
      ['password h Abc@1234', 'Abc@1234'],
      ['mca ka password hai Secretword', 'Secretword'],
      ['password yeh hai Abc@1234', 'Abc@1234'],
      ['password ye hai: Abc@1234', 'Abc@1234'],
      ['pwd hai abcd1234', 'abcd1234'],
      ['mera password Abc@1234 hai', 'Abc@1234'],
      ['otp hai 482913', '482913'],
      ['OTP aaya hai 482913', '482913'],
    ] as const) {
      expect(holdsPortalSecret(text), text).toBe(true);
      expect(maskIdentityNumbers(text), text).not.toContain(kept);
    }
  });

  it('leaves ordinary questions that mention a password alone, in English and Hinglish', () => {
    for (const text of ['What is the password policy?', 'I forgot my password, how do I reset it?', 'Is the MCA password needed for DIR-3 KYC?', 'Where do I change the password for MCA V3?', 'The password is with the director.', 'password reset nahi ho raha', 'password kaise reset kare?', 'password galat hai', 'password expired hai kya karu', 'password change karna hai', 'password ka kya karna hai', 'otp nahi aaya']) {
      expect(holdsPortalSecret(text), text).toBe(false);
    }
  });

  it('leaves questions about them and postal codes alone', () => {
    for (const text of ['the password is incorrect.', 'the password for the portal is wrong', 'pass AOC4 to the client', 'the password-protected file', 'Please change your password and retry', 'Where do I enter the OTP?', 'the password is required', 'The OTP is sent to the director', 'PIN 500081', 'PIN: 500081, Hyderabad', 'what is a DSC token?', 'the secret ballot of 2026', 'prepare the filing run for GSTR-3B']) {
      expect(holdsPortalSecret(text), text).toBe(false);
      expect(maskIdentityNumbers(text), text).toBe(text);
    }
  });
});

describe('safeError', () => {
  it('drops the parameters of a failed query and masks what is left', () => {
    const cause = new Error('value too long for PAN ABCDE1234F');
    const error = Object.assign(new Error('Failed query: insert into profiles values ($1)\nparams: ABCDE1234F,Secret'), { cause });
    const line = safeError(error);
    expect(line).toContain('Failed query');
    expect(line).not.toContain('ABCDE1234F');
    expect(line).not.toContain('Secret');
    expect(line).toContain('XXXXXX234F');
  });

  it('copes with something that is not an Error', () => {
    expect(safeError('PAN ABCDE1234F')).toBe('PAN XXXXXX234F');
  });
});
