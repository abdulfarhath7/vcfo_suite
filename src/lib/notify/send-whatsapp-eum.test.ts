import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readWhatsAppConfig, type WhatsAppConfig } from '@/lib/notify/channels';
import { sendWhatsAppTemplate } from '@/lib/notify/send-whatsapp';
import { isRetryableEumCode, isRetryableWhatsAppError } from '@/lib/notify/whatsapp-retry';
import type { NotifyRecipient } from '@/lib/notify/types';

/**
 * The EUM transport, exercised through the dispatcher with an injected client
 * so no AWS SDK, credentials or network are involved.
 *
 * What matters here is the wire payload: Meta rejects a '+'-prefixed number,
 * an unapproved template name or a mismatched parameter count, and each of
 * those is a silent dropped notification in production.
 */

const PHONE_NUMBER_ID = 'phone-number-id-01234567890123456789012345678901';

function config(patch: Partial<WhatsAppConfig> = {}): WhatsAppConfig {
  const base = readWhatsAppConfig({} as NodeJS.ProcessEnv);
  return {
    ...base,
    enabled: true,
    provider: 'aws_eum',
    eum: { ...base.eum, phoneNumberId: PHONE_NUMBER_ID, region: 'ap-south-1' },
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

/** Decode what the transport actually put on the wire. */
function decode(message: Uint8Array): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(message)) as Record<string, unknown>;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('sendViaEum through the dispatcher', () => {
  it('sends a Cloud API template payload and returns the wamid', async () => {
    let captured: {
      originationPhoneNumberId: string;
      metaApiVersion: string;
      message: Uint8Array;
    } | null = null;

    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'compliance_due_monthly',
      variables: {
        companyName: 'Kestrel Robotics India Pvt Ltd',
        obligationName: 'GSTR-3B',
        dueDate: '20 Apr 2026',
      },
      deps: {
        config: config(),
        createEumClient: async () => async (params) => {
          captured = params;
          return { messageId: 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgS' };
        },
      },
    });

    expect(result).toEqual({
      ok: true,
      status: 'queued',
      providerMessageId: 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgS',
      templateRef: 'compliance_due_monthly',
      toPhone: '+919876543210',
    });

    expect(captured!.originationPhoneNumberId).toBe(PHONE_NUMBER_ID);
    expect(captured!.metaApiVersion).toBe('v21.0');
    expect(decode(captured!.message)).toEqual({
      messaging_product: 'whatsapp',
      // Bare digits: no '+', no 'whatsapp:' prefix.
      to: '919876543210',
      type: 'template',
      template: {
        name: 'compliance_due_monthly',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Kestrel Robotics India Pvt Ltd' },
              { type: 'text', text: 'GSTR-3B' },
              { type: 'text', text: '20 Apr 2026' },
            ],
          },
        ],
      },
    });
  });

  it('honours a template name override and the configured language', async () => {
    let captured: { message: Uint8Array } | null = null;
    const base = config();
    await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: { firstName: 'Asha', companyName: 'Acme' },
      deps: {
        config: {
          ...base,
          eum: {
            ...base.eum,
            templateLanguage: 'en_US',
            templateNames: { ...base.eum.templateNames, welcome: 'vcfo_welcome_v2' },
          },
        },
        createEumClient: async () => async (params) => {
          captured = params;
          return { messageId: 'wamid.1' };
        },
      },
    });

    const payload = decode(captured!.message) as {
      template: { name: string; language: { code: string } };
    };
    expect(payload.template.name).toBe('vcfo_welcome_v2');
    expect(payload.template.language.code).toBe('en_US');
  });

  it('never reaches the transport when the recipient opted out', async () => {
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

  it('makes no AWS call at all when the kill switch is off', async () => {
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

  it('skips instead of calling AWS when no origination number is registered', async () => {
    const base = config();
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: {},
      deps: {
        config: { ...base, eum: { ...base.eum, phoneNumberId: '' } },
        createEumClient: async () => async () => {
          throw new Error('must not be called');
        },
      },
    });
    expect(result).toEqual({ ok: false, status: 'skipped', skipReason: 'disabled' });
  });

  it('reports a failure with the SDK exception name, never throwing', async () => {
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: {},
      deps: {
        config: config(),
        createEumClient: async () => async () => {
          throw Object.assign(new Error('template does not exist'), {
            name: 'ValidationException',
          });
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

  it('fails rather than recording a delivery it cannot correlate', async () => {
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: {},
      deps: {
        config: config(),
        createEumClient: async () => async () => ({ messageId: '  ' }),
      },
    });
    expect(result).toMatchObject({ ok: false, status: 'failed', error: 'eum_no_message_id' });
  });
});

describe('isRetryableEumCode', () => {
  it('stops on errors that will fail identically every time', () => {
    expect(isRetryableEumCode('ValidationException')).toBe(false);
    expect(isRetryableEumCode('InvalidParametersException')).toBe(false);
    expect(isRetryableEumCode('ResourceNotFoundException')).toBe(false);
    expect(isRetryableEumCode('AccessDeniedByMetaException')).toBe(false);
    expect(isRetryableEumCode('131026')).toBe(false); // not a WhatsApp user
    expect(isRetryableEumCode('132001')).toBe(false); // template does not exist
    expect(isRetryableEumCode('131047')).toBe(false); // re-engagement window
  });

  it('retries throttling and transient service errors', () => {
    expect(isRetryableEumCode('ThrottledRequestException')).toBe(true);
    expect(isRetryableEumCode('InternalServiceException')).toBe(true);
    expect(isRetryableEumCode('DependencyException')).toBe(true);
    expect(isRetryableEumCode('130429')).toBe(true);
  });

  it('retries an unrecognised code — a dropped notice is worse than a retry', () => {
    expect(isRetryableEumCode('SomethingNew')).toBe(true);
    expect(isRetryableEumCode(undefined)).toBe(true);
  });
});

describe('isRetryableWhatsAppError', () => {
  it('uses the code set belonging to each provider', () => {
    // A Twilio hard-failure code is meaningless to EUM and vice versa.
    expect(isRetryableWhatsAppError('twilio', '21211')).toBe(false);
    expect(isRetryableWhatsAppError('aws_eum', '21211')).toBe(true);
    expect(isRetryableWhatsAppError('aws_eum', 'ValidationException')).toBe(false);
    expect(isRetryableWhatsAppError('twilio', 'ValidationException')).toBe(true);
  });
});
