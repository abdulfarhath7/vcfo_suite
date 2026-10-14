import { describe, expect, it } from 'vitest';
import { maskPhone } from '@/lib/notify/phone';

describe('maskPhone', () => {
  it('shows an Indian number as +91, five digits, then the last two', () => {
    expect(maskPhone('+919848012300')).toBe('+91 98480 •••00');
  });

  it('hides the middle of any other number and always keeps the last two', () => {
    expect(maskPhone('+14155238886')).toBe('+141552 •••86');
  });

  it('never returns a full number', () => {
    expect(maskPhone('+919848012345')).not.toContain('9848012345');
    expect(maskPhone('12345')).toBe('•••');
    expect(maskPhone(null)).toBe('');
  });
});
