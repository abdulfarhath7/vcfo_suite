import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseAllowlist,
  readWhatsAppConfig,
  resolveWhatsAppChannel,
  isWhatsAppConfigured,
  type WhatsAppConfig,
} from '@/lib/notify/channels';
import { sendWhatsAppTemplate } from '@/lib/notify/send-whatsapp';
import { isRetryableDoubleTickCode, isRetryableWhatsAppError } from '@/lib/notify/whatsapp-retry';
import { skipReasonText, whatsappErrorText } from '@/lib/notify/whatsapp-error-text';
import type { NotifyRecipient } from '@/lib/notify/types';

/**
 * The DoubleTick transport, exercised through the dispatcher with an injected
 * `fetch`, so no key, network or DoubleTick account is involved.
 *
 * What matters is the wire payload (bare-digit numbers, `vcfo_` template name,
 * placeholders in the approved order) and that every failure comes back as a
 * value, never an exception.
 */

const KEY = 'test-key-not-real';
const MESSAGE_ID = '11111111-2222-4333-8444-555555555555';

function config(patch: Partial<WhatsAppConfig> = {}): WhatsAppConfig {
  const base = readWhatsAppConfig({
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_PROVIDER: 'doubletick',
    DOUBLETICK_API_KEY: KEY,
    DOUBLETICK_FROM_NUMBER: '+91 90140 79600',
  } as unknown as NodeJS.ProcessEnv);
  return { ...base, ...patch };
}

const recipient: NotifyRecipient = {
  profileId: 'p1',
  name: 'Asha Rao',
  email: 'asha@example.com',
  phoneE164: '+919876543210',
  whatsappOptInAt: new Date('2026-01-01'),
  whatsappOptOutAt: null,
};

type Captured = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown, captured: Captured[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    return new Response(body === undefined ? '' : JSON.stringify(body), { status });
  }) as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('readWhatsAppConfig for DoubleTick', () => {
  it('reads the provider, a digits-only business number and vcfo_ template names', () => {
    const c = config();
    expect(c.provider).toBe('doubletick');
    expect(c.doubletick.fromNumber).toBe('919014079600');
    expect(c.doubletick.baseUrl).toBe('https://public.doubletick.io');
    expect(c.doubletick.templateNames.step_awaiting_approval).toBe('vcfo_step_awaiting_approval');
    expect(c.eum.templateNames.step_awaiting_approval).toBe('step_awaiting_approval');
    expect(isWhatsAppConfigured(c)).toBe(true);
  });

  it('defaults to EUM, and is not configured for DoubleTick without a key', () => {
    expect(readWhatsAppConfig({} as NodeJS.ProcessEnv).provider).toBe('eum');
    expect(isWhatsAppConfigured(config({ doubletick: { ...config().doubletick, apiKey: '' } }))).toBe(false);
  });
});

describe('rollout allow-list', () => {
  it('normalises entries and ignores separators', () => {
    expect(parseAllowlist('+919876543210, 9876543211 ;+14155550123')).toEqual([
      '+919876543210',
      '+919876543211',
      '+14155550123',
    ]);
  });

  it('is empty (no restriction) when unset, and never widens when every entry is unreadable', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist('   ')).toEqual([]);
    expect(parseAllowlist('abc, x')).toEqual(['+0']);
  });

  it('skips a sendable person who is not on the list, after the consent guards', () => {
    const listed = config({ allowlist: ['+919876543210'] });
    expect(resolveWhatsAppChannel({ recipient, event: 'welcome', config: listed }).send).toBe(true);

    const other = config({ allowlist: ['+919999999999'] });
    expect(resolveWhatsAppChannel({ recipient, event: 'welcome', config: other })).toEqual({
      send: false,
      skipReason: 'not_allowlisted',
    });
    // A person who never consented still reads as no_consent, not as "not listed".
    expect(
      resolveWhatsAppChannel({ recipient: { ...recipient, whatsappOptInAt: null }, event: 'welcome', config: other }),
    ).toEqual({ send: false, skipReason: 'no_consent' });
  });
});

describe('sendViaDoubleTick through the dispatcher', () => {
  it('posts the template with bare-digit numbers and placeholders in the approved order', async () => {
    const captured: Captured[] = [];
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'step_awaiting_approval',
      variables: { firstName: 'Asha', companyName: 'Routeware India', stepTitle: 'Board Resolution' },
      deps: {
        config: config(),
        fetch: fakeFetch(201, { status: 'SENT', recipient: '919876543210', messageId: MESSAGE_ID }, captured),
        newMessageId: () => MESSAGE_ID,
      },
    });

    expect(result).toEqual({
      ok: true,
      status: 'queued',
      providerMessageId: MESSAGE_ID,
      templateRef: 'vcfo_step_awaiting_approval',
      toPhone: '+919876543210',
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toBe('https://public.doubletick.io/whatsapp/message/template');
    expect(captured[0]!.init.method).toBe('POST');
    expect((captured[0]!.init.headers as Record<string, string>).Authorization).toBe(KEY);
    expect(JSON.parse(String(captured[0]!.init.body))).toEqual({
      messages: [
        {
          from: '919014079600',
          to: '919876543210',
          messageId: MESSAGE_ID,
          content: {
            templateName: 'vcfo_step_awaiting_approval',
            language: 'en',
            templateData: { body: { placeholders: ['Asha', 'Board Resolution', 'Routeware India'] } },
          },
        },
      ],
    });
  });

  it('accepts an empty 201 and keeps the messageId it chose', async () => {
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'coi_issued',
      variables: { companyName: 'Routeware India' },
      deps: { config: config(), fetch: fakeFetch(201, undefined), newMessageId: () => MESSAGE_ID },
    });
    expect(result).toMatchObject({ ok: true, status: 'queued', providerMessageId: MESSAGE_ID });
  });

  it('reads the V2 list shape and turns a FAILED message into a failed result', async () => {
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: { firstName: 'Asha', companyName: 'Routeware India' },
      deps: {
        config: config(),
        fetch: fakeFetch(201, { messages: [{ status: 'FAILED', errorMessage: 'Not a WhatsApp user' }] }),
        newMessageId: () => MESSAGE_ID,
      },
    });
    expect(result).toMatchObject({
      ok: false,
      status: 'failed',
      errorCode: 'doubletick_failed',
      error: 'Not a WhatsApp user',
      templateRef: 'vcfo_welcome',
    });
  });

  it('reports an HTTP refusal with its status, and never puts the key in the error', async () => {
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: {},
      deps: { config: config(), fetch: fakeFetch(401, { statusCode: 401, message: 'Unauthorized' }) },
    });
    expect(result).toMatchObject({ ok: false, status: 'failed', errorCode: 'doubletick_http_401', error: 'Unauthorized' });
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it('turns a network throw into a failed result, never an exception', async () => {
    const result = await sendWhatsAppTemplate({
      recipient,
      event: 'welcome',
      variables: {},
      deps: {
        config: config(),
        fetch: (async () => {
          throw new Error('getaddrinfo ENOTFOUND public.doubletick.io');
        }) as typeof fetch,
      },
    });
    expect(result).toMatchObject({ ok: false, status: 'failed', errorCode: 'doubletick_network' });
  });

  it('never calls DoubleTick when a guard skips', async () => {
    const result = await sendWhatsAppTemplate({
      recipient: { ...recipient, phoneE164: null },
      event: 'welcome',
      variables: {},
      deps: {
        config: config(),
        fetch: (async () => {
          throw new Error('must not be called');
        }) as typeof fetch,
      },
    });
    expect(result).toEqual({ ok: false, status: 'skipped', skipReason: 'no_phone' });
  });
});

describe('DoubleTick retry and staff text', () => {
  it('retries outages and rate limits, stops on refusals and FAILED messages', () => {
    expect(isRetryableDoubleTickCode('doubletick_network')).toBe(true);
    expect(isRetryableDoubleTickCode('doubletick_http_429')).toBe(true);
    expect(isRetryableDoubleTickCode('doubletick_http_503')).toBe(true);
    expect(isRetryableDoubleTickCode('doubletick_http_400')).toBe(false);
    expect(isRetryableDoubleTickCode('doubletick_http_401')).toBe(false);
    expect(isRetryableDoubleTickCode('doubletick_failed')).toBe(false);
    // The shared entry point routes DoubleTick codes here and leaves EUM codes alone.
    expect(isRetryableWhatsAppError('doubletick_http_400')).toBe(false);
    expect(isRetryableWhatsAppError('ValidationException')).toBe(false);
    expect(isRetryableWhatsAppError('ThrottledRequestException')).toBe(true);
  });

  it('explains the new codes and skip reason in plain words', () => {
    expect(whatsappErrorText('doubletick_http_401')).toMatch(/API key/);
    expect(whatsappErrorText('doubletick_http_429')).toMatch(/rate limit/);
    expect(skipReasonText('not_allowlisted')).toBe('Not on the WhatsApp test list yet');
  });
});
