import { inngest } from './client';
import { systemGetNotifyRecipient } from '@/db/repositories/profiles';
import { systemRecordDelivery } from '@/db/repositories/notification-deliveries';
import { sendWhatsAppTemplate, isRetryableTwilioCode } from '@/lib/notify/send-whatsapp';
import { isNotifyEvent, type NotifyEvent, type NotifyVariables } from '@/lib/notify/types';

/**
 * Background WhatsApp dispatch.
 *
 * Queued by the notification fan-out AFTER email has already been handled, so
 * a Twilio timeout can never slow a user request or downgrade email.
 *
 * Retries: Inngest retries when the step throws. Transient failures throw (up
 * to 3 attempts, exponential backoff); hard failures — invalid number,
 * unsubscribed, region not enabled — return cleanly so we stop burning
 * attempts on a message that can never land.
 */

export const WHATSAPP_SEND_EVENT = 'whatsapp/send.requested';

/** Inngest serialises step results, so Date columns come back as ISO strings. */
function reviveDate(value: Date | string | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type WhatsAppSendEventData = {
  engagementId: string | null;
  recipientProfileId: string;
  event: NotifyEvent;
  variables: NotifyVariables;
};

export const whatsappSend = inngest.createFunction(
  { id: 'whatsapp-send', retries: 3 },
  { event: WHATSAPP_SEND_EVENT },
  async ({ event, step }) => {
    const data = event.data as WhatsAppSendEventData;

    if (!data?.recipientProfileId || !isNotifyEvent(String(data.event))) {
      return { skipped: 'invalid_payload' };
    }

    // Consent is re-read at send time — the queued payload is not trusted.
    const recipient = await step.run('load-recipient', async () =>
      systemGetNotifyRecipient(data.recipientProfileId),
    );

    if (!recipient) {
      await step.run('record-missing-recipient', async () =>
        systemRecordDelivery({
          engagementId: data.engagementId,
          recipientProfileId: data.recipientProfileId,
          eventType: data.event,
          channel: 'whatsapp',
          status: 'skipped',
          skipReason: 'no_phone',
        }),
      );
      return { skipped: 'recipient_not_found' };
    }

    const result = await step.run('send', async () =>
      sendWhatsAppTemplate({
        recipient: {
          profileId: recipient.profileId,
          name: recipient.name,
          email: recipient.email,
          phoneE164: recipient.phoneE164,
          // step.run round-trips through JSON, so timestamps arrive as strings.
          whatsappOptInAt: reviveDate(recipient.whatsappOptInAt),
          whatsappOptOutAt: reviveDate(recipient.whatsappOptOutAt),
        },
        event: data.event,
        variables: data.variables ?? {},
      }),
    );

    await step.run('record-delivery', async () =>
      systemRecordDelivery({
        engagementId: data.engagementId,
        recipientProfileId: recipient.profileId,
        eventType: data.event,
        channel: 'whatsapp',
        toAddress: 'toPhone' in result ? (result.toPhone ?? null) : null,
        templateSid: 'templateSid' in result ? (result.templateSid ?? null) : null,
        providerMessageId: result.ok ? result.providerMessageId : null,
        status: result.status,
        skipReason: result.status === 'skipped' ? result.skipReason : null,
        errorCode: result.status === 'failed' ? (result.errorCode ?? null) : null,
      }),
    );

    if (result.status === 'failed' && isRetryableTwilioCode(result.errorCode)) {
      // Throwing hands the retry decision to Inngest's backoff.
      throw new Error(`whatsapp_send_retryable:${result.errorCode ?? 'unknown'}`);
    }

    return { status: result.status };
  },
);
