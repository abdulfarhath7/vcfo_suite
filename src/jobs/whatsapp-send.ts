import { inngest } from './client';
import { systemGetNotifyRecipient } from '@/db/repositories/profiles';
import { systemRecordDelivery } from '@/db/repositories/notification-deliveries';
import { sendWhatsAppTemplate } from '@/lib/notify/send-whatsapp';
import { isRetryableWhatsAppError } from '@/lib/notify/whatsapp-retry';
import { isNotifyEvent, type NotifyEvent, type NotifyVariables } from '@/lib/notify/types';

/**
 * Background WhatsApp dispatch.
 *
 * Queued by the notification fan-out AFTER email has already been handled, so
 * an EUM timeout can never slow a user request or downgrade email.
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

type WhatsAppSendEventData = {
  engagementId: string | null;
  recipientProfileId: string;
  event: NotifyEvent;
  variables: NotifyVariables;
  retryOf?: string;
};

const MAX_RETRIES = 3;

export const whatsappSend = inngest.createFunction(
  // Throttle queues excess runs instead of dropping them: at most 20 sends a minute.
  { id: 'whatsapp-send', retries: MAX_RETRIES, throttle: { limit: 20, period: '1m' } },
  { event: WHATSAPP_SEND_EVENT },
  async ({ event, step, attempt }) => {
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
          variables: data.variables ?? {},
          retryOf: data.retryOf ?? null,
        }),
      );
      return { skipped: 'recipient_not_found' };
    }

    const result = await step.run('send', async () => {
      const sent = await sendWhatsAppTemplate({
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
      });
      // Throw inside the step: a step that returns is memoised, so a throw
      // after it would replay the same failure instead of sending again. The
      // last attempt returns the failure so it is recorded.
      if (sent.status === 'failed' && isRetryableWhatsAppError(sent.errorCode) && attempt < MAX_RETRIES) {
        throw new Error(`whatsapp_send_retryable:${sent.errorCode ?? 'unknown'}`);
      }
      return sent;
    });

    await step.run('record-delivery', async () =>
      systemRecordDelivery({
        engagementId: data.engagementId,
        recipientProfileId: recipient.profileId,
        eventType: data.event,
        channel: 'whatsapp',
        toAddress: 'toPhone' in result ? (result.toPhone ?? null) : null,
        // The approved Meta template name; the column is text and only ever
        // held a template reference.
        templateSid: 'templateRef' in result ? (result.templateRef ?? null) : null,
        providerMessageId: result.ok ? result.providerMessageId : null,
        status: result.status,
        skipReason: result.status === 'skipped' ? result.skipReason : null,
        errorCode: result.status === 'failed' ? (result.errorCode ?? null) : null,
        variables: data.variables ?? {},
        retryOf: data.retryOf ?? null,
      }),
    );

    return { status: result.status };
  },
);
