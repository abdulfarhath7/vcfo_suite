import { describe, expect, it } from 'vitest';
import {
  isWhatsAppConfigured,
  readWhatsAppConfig,
  resolveWhatsAppChannel,
  templateRefFor,
  type WhatsAppConfig,
} from '@/lib/notify/channels';
import type { NotifyRecipient } from '@/lib/notify/types';

/**
 * The guards are the only thing standing between a consented recipient and an
 * unwanted message, so they are pinned here directly: pure in, pure out, no
 * env and no provider SDK.
 */

/**
 * Built from the real reader on an empty env, so a new config field cannot
 * drift out of the fixtures — only the origination number id is filled in.
 */
function config(patch: Partial<WhatsAppConfig> = {}): WhatsAppConfig {
  const base = readWhatsAppConfig({} as NodeJS.ProcessEnv);
  return {
    ...base,
    enabled: true,
    eum: { ...base.eum, phoneNumberId: 'phone-number-id-01234567890123456789012345678901' },
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
  it('needs only the kill switch on and a registered number id', () => {
    expect(isWhatsAppConfigured(config())).toBe(true);
    expect(isWhatsAppConfigured(config({ enabled: false }))).toBe(false);
    expect(
      isWhatsAppConfigured({ ...config(), eum: { ...config().eum, phoneNumberId: '' } }),
    ).toBe(false);
  });
});

describe('templateRefFor', () => {
  it('defaults every event to its own name and honours an override', () => {
    expect(templateRefFor(config(), 'welcome')).toBe('welcome');
    expect(templateRefFor(config(), 'coi_issued')).toBe('coi_issued');
    const overridden = config({
      eum: { ...config().eum, templateNames: { ...config().eum.templateNames, welcome: 'vcfo_welcome' } },
    });
    expect(templateRefFor(overridden, 'welcome')).toBe('vcfo_welcome');
  });
});

describe('resolveWhatsAppChannel', () => {
  it('sends every event without per-event template env', () => {
    expect(
      resolveWhatsAppChannel({ recipient: recipient(), event: 'welcome', config: config() }),
    ).toEqual({ send: true, toPhone: '+919876543210', templateRef: 'welcome' });
    expect(
      resolveWhatsAppChannel({ recipient: recipient(), event: 'coi_issued', config: config() }),
    ).toEqual({ send: true, toPhone: '+919876543210', templateRef: 'coi_issued' });
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
        event: 'nope',
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
  it('defaults the EUM settings without any EUM env set', () => {
    const cfg = readWhatsAppConfig({} as NodeJS.ProcessEnv);
    expect(cfg.eum.templateLanguage).toBe('en');
    expect(cfg.eum.metaApiVersion).toBe('v21.0');
    expect(cfg.eum.phoneNumberId).toBe('');
    expect(cfg.eum.templateNames.welcome).toBe('welcome');
  });

  it('falls back to AWS_REGION when the EUM region is unset', () => {
    expect(
      readWhatsAppConfig({ AWS_REGION: 'ap-south-1' } as unknown as NodeJS.ProcessEnv).eum.region,
    ).toBe('ap-south-1');
    expect(
      readWhatsAppConfig({
        AWS_REGION: 'ap-south-1',
        SOCIAL_MESSAGING_REGION: 'us-east-1',
      } as unknown as NodeJS.ProcessEnv).eum.region,
    ).toBe('us-east-1');
  });

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
