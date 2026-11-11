import { describe, expect, it } from 'vitest';
import { createAskMasker, maskIdentityNumbers, namesFromLabelledText } from './mask';

describe('maskIdentityNumbers', () => {
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

  it('masks a number joined to a file name by an underscore', () => {
    expect(maskIdentityNumbers('ABCDE1234F_Rahul_PAN.pdf')).toBe('XXXXXX234F_Rahul_PAN.pdf');
    expect(maskIdentityNumbers('aadhaar_234567890123.jpg')).toBe('aadhaar_XXXXXXXX0123.jpg');
  });

  it('leaves public registry numbers and ordinary text alone', () => {
    const text = 'GSTIN 22AAAAA0000A1Z5, CIN U74999TG2020PTC123456, 12 directors on 01-04-2026, 12345678';
    expect(maskIdentityNumbers(text)).toBe(text);
  });
});

describe('createAskMasker', () => {
  it('swaps contact details for stable placeholders and restores them', () => {
    const masker = createAskMasker();
    const text = 'Mail asha.rao@example.com or call +91 98765 43210, office (080) 2345 6789. Again: Asha.Rao@example.com';
    const masked = masker.mask(text);
    expect(masked).toBe('Mail [EMAIL_1] or call [PHONE_1], office [PHONE_2]. Again: [EMAIL_1]');
    expect(masker.unmask('Write to [EMAIL_1] or ring [PHONE_1].')).toBe('Write to asha.rao@example.com or ring +91 98765 43210.');
  });

  it('masks mobiles without a country code, and landlines with an STD code', () => {
    const masker = createAskMasker();
    expect(masker.mask('Mobile 9876543210, landline 022-24567890')).toBe('Mobile [PHONE_1], landline [PHONE_2]');
    expect(masker.mask('call 09876543210')).toBe('call [PHONE_1]');
  });

  it('masks bank account numbers and keeps the IFSC visible', () => {
    const masker = createAskMasker();
    expect(masker.mask('Account no: 123456789012 IFSC HDFC0001234')).toBe('Account no: [BANK_ACCOUNT_1] IFSC HDFC0001234');
    expect(masker.mask('A/c 50100123456789')).toBe('A/c [BANK_ACCOUNT_2]');
  });

  it('masks a pincode only next to an address', () => {
    const masker = createAskMasker();
    expect(masker.mask('Address: 12 MG Road, Bengaluru 560001')).toBe('Address: 12 MG Road, Bengaluru [PINCODE_1]');
    expect(masker.mask('Registered office:\nNo 4, 2nd Floor\nChennai 600017')).toBe('Registered office:\nNo 4, 2nd Floor\nChennai [PINCODE_2]');
    expect(masker.mask('We raised 560001 rupees.')).toBe('We raised 560001 rupees.');
  });

  it('masks an 8-digit DIN in a director context but not elsewhere', () => {
    const masker = createAskMasker();
    expect(masker.mask('The director 01234567 resigned')).toBe('The director [DIN_1] resigned');
    expect(masker.mask('Invoice 12345678')).toBe('Invoice 12345678');
    expect(masker.mask('DIN: 01234567')).toBe('DIN: [DIN_1]');
  });

  it('restores identity numbers only in their last-four form, never the full Aadhaar', () => {
    const masker = createAskMasker();
    const masked = masker.mask('PAN ABCDE1234F, Aadhaar 2345 6789 0123, passport J8369854');
    expect(masked).toBe('PAN [PAN_1], Aadhaar [AADHAAR_1], passport [PASSPORT_1]');
    const back = masker.unmask(masked);
    expect(back).toBe('PAN XXXXXX234F, Aadhaar XXXXXXXX0123, passport XXXX9854');
    expect(back).not.toContain('2345 6789 0123');
    // Restored text going back out never carries the full number either.
    expect(masker.mask(back)).not.toMatch(/2345\s?6789/);
  });

  it('masks the people the engagement knows, in full or as first and last name', () => {
    const masker = createAskMasker({ people: [{ name: 'Asha Kumari Rao', kind: 'DIRECTOR' }, { name: 'Ravi Menon', kind: 'CLIENT' }] });
    expect(masker.mask('asha kumari rao and Asha Rao met Ravi Menon')).toBe('[DIRECTOR_1] and [DIRECTOR_1] met [CLIENT_1]');
    expect(masker.unmask('[DIRECTOR_1] signs')).toBe('Asha Kumari Rao signs');
  });

  it('leaves public registry numbers, IFSC and an unknown placeholder alone', () => {
    const masker = createAskMasker();
    const text = 'GSTIN 22AAAAA0000A1Z5, CIN U74999TG2020PTC123456, SBIN0005943';
    expect(masker.mask(text)).toBe(text);
    expect(masker.unmask('[EMAIL_9]')).toBe('[EMAIL_9]');
  });

  it('works through nested values', () => {
    const masker = createAskMasker();
    const masked = masker.maskDeep({ a: ['x@y.in'], b: { c: 9876543210 } });
    expect(masked).toEqual({ a: ['[EMAIL_1]'], b: { c: 9876543210 } });
    expect(masker.unmaskDeep(masked)).toEqual({ a: ['x@y.in'], b: { c: 9876543210 } });
  });
});

describe('namesFromLabelledText', () => {
  it('reads names from labelled lines', () => {
    expect(namesFromLabelledText('Name: Asha Rao\nDirector 2: Ravi Kumar\nPAN: ABCDE1234F')).toEqual([
      { name: 'Asha Rao', kind: 'DIRECTOR' },
      { name: 'Ravi Kumar', kind: 'DIRECTOR' },
    ]);
  });
});
