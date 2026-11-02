import { describe, expect, it } from 'vitest';
import { contactHref, makeTempPassword, prettyPhone } from './contact';

describe('contactHref', () => {
  const c = { email: 'lead@sbcllp.in', phoneE164: '+919059790014', whatsappE164: '+919000000001' };
  it('prefers the WhatsApp number, falls back to the phone', () => {
    expect(contactHref('wa', c)).toBe('https://wa.me/919000000001');
    expect(contactHref('wa', { phoneE164: '+91 90597 90014' })).toBe('https://wa.me/919059790014');
    expect(contactHref('wa', {})).toBeNull();
  });
  it('builds tel:, mailto: and Teams links', () => {
    expect(contactHref('call', c)).toBe('tel:+919059790014');
    expect(contactHref('email', c)).toBe('mailto:lead@sbcllp.in');
    expect(contactHref('teams', c)).toBe('https://teams.microsoft.com/l/chat/0/0?users=lead%40sbcllp.in');
    expect(contactHref('teams', {})).toBeNull();
  });
});

describe('prettyPhone', () => {
  it('spaces an Indian mobile number', () => {
    expect(prettyPhone('+919059790014')).toBe('+91 90597 90014');
    expect(prettyPhone('+14155550100')).toBe('+14155550100');
    expect(prettyPhone(null)).toBe('');
  });
});

describe('makeTempPassword', () => {
  it('is 10 characters with a capital, a symbol and digits', () => {
    const pw = makeTempPassword();
    expect(pw).toHaveLength(10);
    expect(pw).toMatch(/^[A-Z][a-z]{3}[#@!$%]\d{3}[A-Z][a-z]$/);
  });
});
