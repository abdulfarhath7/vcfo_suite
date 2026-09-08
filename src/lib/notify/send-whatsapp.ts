import 'server-only';

import { readWhatsAppConfig, resolveWhatsAppChannel } from '@/lib/notify/channels';
import type {
  SendWhatsAppDeps,
  WhatsAppSendResult,
} from '@/lib/notify/send-whatsapp-shared';
import { sendViaTwilio } from '@/lib/notify/send-whatsapp-twilio';
import type { NotifyEvent, NotifyRecipient, NotifyVariables } from '@/lib/notify/types';

/**
 * WhatsApp transport dispatcher.
 *
 * - `WHATSAPP_PROVIDER=twilio` (default) → Twilio Content Templates
 * - `WHATSAPP_PROVIDER=aws_eum` → AWS End User Messaging (Social)
 *
 * Exactly the shape of the email dispatcher (`send-email.ts` → `sendViaSes` /
 * `sendViaResend`), and for the same reason: one bill, one switch, no call-site
 * churn.
 *
 * Contract, unchanged by the switch: this NEVER throws and NEVER blocks email.
 * Every outcome — queued, skipped or failed — comes back as a value the caller
 * writes to `notification_deliveries`. Missing credentials mirror the email
 * dispatcher's console-skip so local dev and CI never send.
 *
 * The guards run here, once, for both providers: `resolveWhatsAppChannel` is
 * pure and returns a provider-neutral `templateRef`, so a transport only ever
 * receives a resolved phone number and template reference.
 */

export type {
  WhatsAppProvider,
  WhatsAppSendResult,
  SendWhatsAppDeps,
  TwilioMessageCreate,
} from '@/lib/notify/send-whatsapp-shared';
export { resolveWhatsAppProvider } from '@/lib/notify/send-whatsapp-shared';
export { isRetryableTwilioCode } from '@/lib/notify/send-whatsapp-twilio';

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

  const shared = {
    config,
    event: input.event,
    variables: input.variables,
    toPhone: decision.toPhone,
    templateRef: decision.templateRef,
    deps: input.deps,
  };

  return sendViaTwilio(shared);
}

/**
 * Queue one WhatsApp template onto the background path.
 *
 * Fire-and-forget by design: this is called from request handlers AFTER email
 * has been dispatched, and it never throws. A queue failure is logged and the
 * request continues — email remains the system of record.
 *
 * Provider-neutral: which transport runs is decided in the job, at send time.
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
