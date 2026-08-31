import 'server-only';

import {
  readWhatsAppConfig,
  resolveWhatsAppChannel,
  withWhatsAppPrefix,
  type WhatsAppConfig,
} from '@/lib/notify/channels';
import { buildContentVariables } from '@/lib/notify/templates';
import type {
  NotifyEvent,
  NotifyRecipient,
  NotifyVariables,
  SkipReason,
} from '@/lib/notify/types';

/**
 * Twilio WhatsApp transport.
 *
 * Contract: NEVER throws and NEVER blocks email. Every outcome — sent, skipped
 * or failed — comes back as a value the caller writes to
 * `notification_deliveries`. Missing credentials mirror the email dispatcher's
 * console-skip so local dev and CI never send.
 *
 * The Twilio client is constructed per call (injectable via `deps.createClient`)
 * so nothing is built at module scope.
 */

export type WhatsAppSendResult =
  | { ok: true; status: 'queued'; providerMessageId: string; templateSid: string; toPhone: string }
  | { ok: false; status: 'skipped'; skipReason: SkipReason; templateSid?: string; toPhone?: string }
  | { ok: false; status: 'failed'; error: string; errorCode?: string; templateSid?: string; toPhone?: string };

export type TwilioMessageCreate = (params: {
  to: string;
  contentSid: string;
  contentVariables: string;
  from?: string;
  messagingServiceSid?: string;
  statusCallback?: string;
}) => Promise<{ sid: string }>;

export type SendWhatsAppDeps = {
  config?: WhatsAppConfig;
  createClient?: (config: WhatsAppConfig) => Promise<TwilioMessageCreate>;
};

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
 * Send one pre-approved template to one recipient.
 * Returns a skip result rather than throwing when any guard fails.
 */
export async function sendWhatsAppTemplate(input: {
  recipient: NotifyRecipient;
  event: NotifyEvent;
  variables: NotifyVariables;
  deps?: SendWhatsAppDeps;
}): Promise<WhatsAppSendResult> {
  const config = input.deps?.config ?? readWhatsAppConfig();

  const decision = resolveWhatsAppChannel({
    recipient: input.recipient,
    event: input.event,
    config,
  });

  if (decision.send === false) {
    if (decision.skipReason === 'disabled') {
      // Mirrors the email dispatcher's console skip.
      console.log('[whatsapp] skipped — not configured', input.event);
    }
    return { ok: false, status: 'skipped', skipReason: decision.skipReason };
  }

  const { toPhone, templateSid } = decision;

  try {
    const createMessage =
      (await input.deps?.createClient?.(config)) ?? (await defaultCreateClient(config));

    const message = await createMessage({
      to: withWhatsAppPrefix(toPhone),
      contentSid: templateSid,
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
      templateSid,
      toPhone,
    };
  } catch (err) {
    const errorCode = errorCodeOf(err);
    const error = err instanceof Error ? err.message : 'whatsapp_send_failed';
    console.error('[whatsapp] send failed', input.event, errorCode ?? '', error);
    return { ok: false, status: 'failed', error, errorCode, templateSid, toPhone };
  }
}

/**
 * Queue one WhatsApp template onto the background path.
 *
 * Fire-and-forget by design: this is called from request handlers AFTER email
 * has been dispatched, and it never throws. A queue failure is logged and the
 * request continues — email remains the system of record.
 */
export async function queueWhatsAppSend(input: {
  engagementId: string | null;
  recipientProfileId: string;
  event: NotifyEvent;
  variables: NotifyVariables;
  /**
   * Deterministic id for at-most-once delivery. Inngest drops a repeat event
   * with the same id, so a job re-run on the same day cannot double-message.
   */
  dedupeId?: string;
}): Promise<void> {
  try {
    const { inngest } = await import('@/jobs/client');
    const { WHATSAPP_SEND_EVENT } = await import('@/jobs/whatsapp-send');
    await inngest.send({
      name: WHATSAPP_SEND_EVENT,
      ...(input.dedupeId ? { id: input.dedupeId } : {}),
      data: {
        engagementId: input.engagementId,
        recipientProfileId: input.recipientProfileId,
        event: input.event,
        variables: input.variables,
      },
    });
  } catch (err) {
    console.error('[whatsapp] queue failed', input.event, err);
  }
}

/**
 * Queue for several recipients at once. Skips anyone without a profile id.
 * Resolves after every enqueue settles; individual failures are swallowed.
 */
export async function queueWhatsAppSends(
  inputs: Array<{
    engagementId: string | null;
    recipientProfileId: string;
    event: NotifyEvent;
    variables: NotifyVariables;
    dedupeId?: string;
  }>,
): Promise<void> {
  await Promise.all(
    inputs
      .filter((i) => i.recipientProfileId?.trim())
      .map((i) => queueWhatsAppSend(i)),
  );
}
