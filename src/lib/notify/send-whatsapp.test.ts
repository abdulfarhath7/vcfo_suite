import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendWhatsAppTemplate } from '@/lib/notify/send-whatsapp';
import { readWhatsAppConfig, type WhatsAppConfig } from '@/lib/notify/channels';
import type { NotifyRecipient } from '@/lib/notify/types';

/**
 * The dispatcher's contract: it never throws, it runs the guards once, and it
 * hands a resolved phone + template name to the EUM transport. The EUM client
 * is injected, so nothing here needs credentials or the network.
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

const recipient: NotifyRecipient = {
  profileId: 'p1',
  name: 'Asha Rao',
  email: 'asha@example.com',
  phoneE164: '+919876543210',
  whatsappOptInAt: new Date('2026-01-01'),
  whatsappOptOutAt: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('sendWhatsAppTemplate', () => {
  it('dispatches to EUM with the resolved phone and template name', async () => {
    const calls: Array<{ originationPhoneNumberId: string; message: Uint8Array }> = [];
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: { firstName: 'Asha', companyName: 'Kestrel Robotics India Pvt Ltd' },
      deps: {
        config: config(),
        createEumClient: async () => async (params) => {
          calls.push(params);
          return { messageId: 'wamid.1' };
        },
      },
    });

    expect(result).toEqual({
      ok: true,
      status: 'queued',
      providerMessageId: 'wamid.1',
      templateRef: 'welcome',
      toPhone: '+919876543210',
    });
    expect(calls[0]?.originationPhoneNumberId).toBe(
      'phone-number-id-01234567890123456789012345678901',
    );
    const payload = JSON.parse(new TextDecoder().decode(calls[0]!.message)) as {
      to: string;
      template: { name: string };
    };
    expect(payload.to).toBe('919876543210');
    expect(payload.template.name).toBe('welcome');
  });

  it('returns a skip rather than throwing when a guard fails', async () => {
    const result = await sendWhatsAppTemplate({
      recipient: { ...recipient, whatsappOptOutAt: new Date() },
      event: 'welcome',
      variables: {},
      deps: {
        config: config(),
        createEumClient: async () => async () => {
          throw new Error('must not be called');
        },
      },
    });
    expect(result).toEqual({ ok: false, status: 'skipped', skipReason: 'opted_out' });
  });

  it('console-skips instead of sending when the kill switch is off', async () => {
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: {},
      deps: {
        config: config({ enabled: false }),
        createEumClient: async () => async () => {
          throw new Error('must not be called');
        },
      },
    });
    expect(result).toEqual({ ok: false, status: 'skipped', skipReason: 'disabled' });
  });

  it('turns a transport throw into a failed result, never an exception', async () => {
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: {},
      deps: {
        config: config(),
        createEumClient: async () => async () => {
          throw Object.assign(new Error('bad parameter'), { name: 'ValidationException' });
        },
      },
    });
    expect(result).toMatchObject({
      ok: false,
      status: 'failed',
      errorCode: 'ValidationException',
      templateRef: 'welcome',
      toPhone: '+919876543210',
    });
  });
});
