import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isRetryableTwilioCode,
  resolveWhatsAppProvider,
  sendWhatsAppTemplate,
} from '@/lib/notify/send-whatsapp';
import { readWhatsAppConfig, type WhatsAppConfig } from '@/lib/notify/channels';
import type { NotifyRecipient } from '@/lib/notify/types';

/**
 * The dispatcher's contract: it never throws, it runs the guards once for
 * every provider, and it hands a resolved phone + template reference to the
 * transport. The Twilio client is injected, so nothing here needs credentials
 * or the network.
 */

/**
 * Built from the real reader on an empty env, so a new config field cannot
 * drift out of the fixtures — only the Twilio credentials are filled in.
 */
function config(patch: Partial<WhatsAppConfig> = {}): WhatsAppConfig {
  return {
    ...readWhatsAppConfig({} as NodeJS.ProcessEnv),
    enabled: true,
    accountSid: 'AC-test',
    authToken: 'token',
    from: 'whatsapp:+14155238886',
    statusCallbackUrl: 'https://example.test/api/webhooks/twilio/status',
    templateSids: { welcome: 'HX-welcome' },
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

describe('resolveWhatsAppProvider', () => {
  it('defaults to twilio until an EUM number is registered', () => {
    expect(resolveWhatsAppProvider({} as NodeJS.ProcessEnv)).toBe('twilio');
    expect(
      resolveWhatsAppProvider({ WHATSAPP_PROVIDER: 'aws_eum' } as unknown as NodeJS.ProcessEnv),
    ).toBe('aws_eum');
    expect(
      resolveWhatsAppProvider({ WHATSAPP_PROVIDER: 'nonsense' } as unknown as NodeJS.ProcessEnv),
    ).toBe('twilio');
  });
});

describe('sendWhatsAppTemplate — Twilio path', () => {
  it('sends the approved template with positional variables and reports queued', async () => {
    const calls: unknown[] = [];
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      // Call sites apply `firstNameOf` before queueing; the transport passes
      // whatever it is handed straight through.
      variables: { firstName: 'Asha', companyName: 'Kestrel Robotics India Pvt Ltd' },
      deps: {
        config: config(),
        createClient: async () => async (params) => {
          calls.push(params);
          return { sid: 'SM123' };
        },
      },
    });

    expect(result).toEqual({
      ok: true,
      status: 'queued',
      providerMessageId: 'SM123',
      templateRef: 'HX-welcome',
      toPhone: '+919876543210',
    });
    expect(calls[0]).toEqual({
      to: 'whatsapp:+919876543210',
      contentSid: 'HX-welcome',
      // Positional keys matching the approved template body.
      contentVariables: '{"1":"Asha","2":"Kestrel Robotics India Pvt Ltd"}',
      from: 'whatsapp:+14155238886',
      statusCallback: 'https://example.test/api/webhooks/twilio/status',
    });
  });

  it('prefers a messaging service over a from number', async () => {
    let sent: { from?: string; messagingServiceSid?: string } | null = null;
    await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: {},
      deps: {
        config: config({ messagingServiceSid: 'MG-1' }),
        createClient: async () => async (params) => {
          sent = params;
          return { sid: 'SM1' };
        },
      },
    });
    expect(sent!.messagingServiceSid).toBe('MG-1');
    expect(sent!.from).toBeUndefined();
  });

  it('returns a skip rather than throwing when a guard fails', async () => {
    const result = await sendWhatsAppTemplate({
      recipient: { ...recipient, whatsappOptOutAt: new Date() },
      event: 'welcome',
      variables: {},
      deps: {
        config: config(),
        createClient: async () => async () => {
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
      deps: { config: config({ enabled: false }) },
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
        createClient: async () => async () => {
          throw Object.assign(new Error('invalid To number'), { code: 21211 });
        },
      },
    });
    expect(result).toMatchObject({
      ok: false,
      status: 'failed',
      errorCode: '21211',
      templateRef: 'HX-welcome',
      toPhone: '+919876543210',
    });
  });
});

describe('isRetryableTwilioCode', () => {
  it('stops on hard failures and retries the rest', () => {
    expect(isRetryableTwilioCode('21211')).toBe(false);
    expect(isRetryableTwilioCode('21610')).toBe(false);
    expect(isRetryableTwilioCode('63016')).toBe(false);
    expect(isRetryableTwilioCode('20429')).toBe(true);
    expect(isRetryableTwilioCode(undefined)).toBe(true);
  });
});
