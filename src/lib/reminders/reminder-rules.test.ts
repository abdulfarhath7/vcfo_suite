import { describe, expect, it } from 'vitest';
import { remindableItemKey, whatsappConsentOf } from '@/lib/reminders/reminder-rules';

describe('whatsappConsentOf', () => {
  it('needs a valid phone, an opt-in and no opt-out, in that order', () => {
    expect(whatsappConsentOf({ phoneE164: null, whatsappOptInAt: new Date() })).toBe('no_phone');
    expect(whatsappConsentOf({ phoneE164: '+919876543210', whatsappOptInAt: null })).toBe('no_consent');
    expect(
      whatsappConsentOf({ phoneE164: '+919876543210', whatsappOptInAt: new Date(), whatsappOptOutAt: new Date() }),
    ).toBe('opted_out');
    expect(whatsappConsentOf({ phoneE164: '+919876543210', whatsappOptInAt: new Date() })).toBe('opted_in');
  });
});

describe('remindableItemKey', () => {
  it('offers Remind only for what the client holds', () => {
    expect(remindableItemKey({ id: 'step:e1:pre-2', kind: 'waiting-client' })).toBe('step:e1:pre-2');
    expect(remindableItemKey({ id: 'request:r1', kind: 'waiting-request' })).toBe('request:r1');
    expect(remindableItemKey({ id: 'step:e1:pre-2', kind: 'waiting-manager' })).toBeNull();
    expect(remindableItemKey({ id: 'filing:f1', kind: 'filing' })).toBeNull();
  });
});
