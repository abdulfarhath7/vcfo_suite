import { describe, expect, it } from 'vitest';
import { maskIdentityNumbers } from './mask';

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
