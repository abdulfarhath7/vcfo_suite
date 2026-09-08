import { describe, expect, it } from 'vitest';
import {
  isWhatsAppConfigured,
  readWhatsAppConfig,
  resolveWhatsAppChannel,
  type WhatsAppConfig,
} from '@/lib/notify/channels';
import type { NotifyRecipient } from '@/lib/notify/types';

/**
 * The guards are the only thing standing between a consented recipient and an
 * unwanted message, so they are pinned here directly: pure in, pure out, no
 * env and no provider SDK.
 */

function config(patch: Partial<WhatsAppConfig> = {}): WhatsAppConfig {
  return {
    enabled: true,
    accountSid: 'AC-test',
    authToken: 'token',
    from: 'whatsapp:+14155238886',
    messagingServiceSid: '',
    statusCallbackUrl: '',
    inboundCallbackUrl: '',
    templateSids: { welcome: 'HX-welcome' },
    ...patch,
  };
}

function recipient(patch: Partial<NotifyRecipient> = {}): NotifyRecipient {
  return {
    profileId: 'p1',
    name: 'Asha Rao',
    email: 'asha@example.com',
    phoneE164: '+919876543210',
    whatsappOptInAt: new Date('2026-01-01'),
    whatsappOptOutAt: null,
    ...patch,
  };
}

describe('isWhatsAppConfigured', () => {
  it('needs the kill switch on and credentials with one sender form', () => {
    expect(isWhatsAppConfigured(config())).toBe(true);
    expect(isWhatsAppConfigured(config({ enabled: false }))).toBe(false);
    expect(isWhatsAppConfigured(config({ accountSid: '' }))).toBe(false);
    expect(isWhatsAppConfigured(config({ authToken: '' }))).toBe(false);
    expect(isWhatsAppConfigured(config({ from: '', messagingServiceSid: '' }))).toBe(false);
    expect(
      isWhatsAppConfigured(config({ from: '', messagingServiceSid: 'MG-1' })),
    ).toBe(true);
  });
});

describe('resolveWhatsAppChannel', () => {
  it('returns a provider-neutral template reference on a send', () => {
    expect(
      resolveWhatsAppChannel({ recipient: recipient(), event: 'welcome', config: config() }),
    ).toEqual({ send: true, toPhone: '+919876543210', templateRef: 'HX-welcome' });
  });

  it('keeps the guard order disabled → no_template → no_phone → no_consent → opted_out', () => {
    // Disabled beats everything, including a recipient who also opted out.
    expect(
      resolveWhatsAppChannel({
        recipient: recipient({ phoneE164: null, whatsappOptOutAt: new Date() }),
        event: 'welcome',
        config: config({ enabled: false }),
      }),
    ).toEqual({ send: false, skipReason: 'disabled' });

    // No template beats a missing phone.
    expect(
      resolveWhatsAppChannel({
        recipient: recipient({ phoneE164: null }),
        event: 'coi_issued',
        config: config(),
      }),
    ).toEqual({ send: false, skipReason: 'no_template' });

    // Never opted in reads as no_consent, not opted_out.
    expect(
      resolveWhatsAppChannel({
        recipient: recipient({ whatsappOptInAt: null }),
        event: 'welcome',
        config: config(),
      }),
    ).toEqual({ send: false, skipReason: 'no_consent' });

    expect(
      resolveWhatsAppChannel({
        recipient: recipient({ whatsappOptOutAt: new Date() }),
        event: 'welcome',
        config: config(),
      }),
    ).toEqual({ send: false, skipReason: 'opted_out' });
  });

  it('rejects an unknown event and a malformed phone', () => {
    expect(
      resolveWhatsAppChannel({ recipient: recipient(), event: 'nope', config: config() }),
    ).toEqual({ send: false, skipReason: 'no_template' });

    expect(
      resolveWhatsAppChannel({
        recipient: recipient({ phoneE164: '9876543210' }),
        event: 'welcome',
        config: config(),
      }),
    ).toEqual({ send: false, skipReason: 'no_phone' });
  });
});

describe('readWhatsAppConfig', () => {
  it('is off unless WHATSAPP_ENABLED is exactly true', () => {
    expect(readWhatsAppConfig({} as NodeJS.ProcessEnv).enabled).toBe(false);
    expect(
      readWhatsAppConfig({ WHATSAPP_ENABLED: 'TRUE' } as unknown as NodeJS.ProcessEnv).enabled,
    ).toBe(true);
    expect(
      readWhatsAppConfig({ WHATSAPP_ENABLED: '1' } as unknown as NodeJS.ProcessEnv).enabled,
    ).toBe(false);
  });
});
