import { describe, expect, it } from 'vitest';
import { skipReasonText, whatsappErrorText } from '@/lib/notify/whatsapp-error-text';

describe('whatsappErrorText', () => {
  it('names the common Meta failures in plain words', () => {
    expect(whatsappErrorText('131026')).toBe('Number is not on WhatsApp');
    expect(whatsappErrorText('132001')).toBe('Template not approved on Meta under this name');
    expect(whatsappErrorText('131047')).toBe(
      'More than 24 hours since the client last wrote; a template is needed',
    );
  });

  it('reads every throttling code as a rate limit that will retry', () => {
    for (const code of ['130429', '131048', 'ThrottledRequestException']) {
      expect(whatsappErrorText(code)).toBe('WhatsApp rate limit; will retry');
    }
  });

  it('falls back to the raw code', () => {
    expect(whatsappErrorText('999999')).toBe('WhatsApp failed (999999)');
    expect(whatsappErrorText(null)).toBe('WhatsApp failed (no code)');
  });
});

describe('skipReasonText', () => {
  it('explains each skip reason', () => {
    expect(skipReasonText('opted_out')).toBe('Replied STOP on WhatsApp');
    expect(skipReasonText('no_consent')).toBe('Has not opted in to WhatsApp');
    expect(skipReasonText(null)).toBeNull();
  });
});
