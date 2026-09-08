import 'server-only';

import { withWhatsAppPrefix, type WhatsAppConfig } from '@/lib/notify/channels';
import { buildContentVariables } from '@/lib/notify/templates';
import type {
  SendWhatsAppDeps,
  TwilioMessageCreate,
  WhatsAppSendResult,
} from '@/lib/notify/send-whatsapp-shared';
import type { NotifyEvent, NotifyVariables } from '@/lib/notify/types';

/**
 * TWILIO WhatsApp transport — the legacy provider, kept selectable via
 * `WHATSAPP_PROVIDER=twilio`.
 *
 * Contract: NEVER throws. Every outcome comes back as a value the caller
 * writes to `notification_deliveries`.
 *
 * Extracted verbatim from `send-whatsapp.ts` when the provider switch landed;
 * the wire behaviour is unchanged. The Twilio client is constructed per call
 * (injectable via `deps.createClient`) so nothing is built at module scope.
 */

/** Hard failures — retrying an invalid number just burns attempts. */
const NON_RETRYABLE_CODES = new Set([
  '21211', // invalid 'To' number
  '21408', // permission to send to this region not enabled
  '21610', // recipient unsubscribed
  '21614', // 'To' number not a valid mobile
  '63003', // channel could not find To address
  '63016', // free-form message outside session (template required)
  '63024', // invalid message-send request
]);

export function isRetryableTwilioCode(code: string | undefined): boolean {
  if (!code) return true;
  return !NON_RETRYABLE_CODES.has(code.trim());
}

async function defaultCreateClient(
  config: WhatsAppConfig,
): Promise<TwilioMessageCreate> {
  const { default: twilio } = await import('twilio');
  const client = twilio(config.accountSid, config.authToken);
  return (params) => client.messages.create(params);
}

function errorCodeOf(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'number' || typeof code === 'string') return String(code);
  }
  return undefined;
}

/**
 * Send one approved Content Template. The guards have already run in the
 * dispatcher, so this receives a resolved phone and template SID.
 */
export async function sendViaTwilio(input: {
  config: WhatsAppConfig;
  event: NotifyEvent;
  variables: NotifyVariables;
  toPhone: string;
  templateRef: string;
  deps?: SendWhatsAppDeps;
}): Promise<WhatsAppSendResult> {
  const { config, toPhone, templateRef } = input;

  try {
    const createMessage =
      (await input.deps?.createClient?.(config)) ?? (await defaultCreateClient(config));

    const message = await createMessage({
      to: withWhatsAppPrefix(toPhone),
      contentSid: templateRef,
      contentVariables: buildContentVariables(input.event, input.variables),
      // A messaging service wins when both are configured.
      ...(config.messagingServiceSid
        ? { messagingServiceSid: config.messagingServiceSid }
        : { from: withWhatsAppPrefix(config.from) }),
      ...(config.statusCallbackUrl ? { statusCallback: config.statusCallbackUrl } : {}),
    });

    return {
      ok: true,
      status: 'queued',
      providerMessageId: message.sid,
      templateRef,
      toPhone,
    };
  } catch (err) {
    const errorCode = errorCodeOf(err);
    const error = err instanceof Error ? err.message : 'whatsapp_send_failed';
    console.error('[whatsapp:twilio] send failed', input.event, errorCode ?? '', error);
    return { ok: false, status: 'failed', error, errorCode, templateRef, toPhone };
  }
}
