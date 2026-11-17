import 'server-only';

import { readWhatsAppConfig, resolveWhatsAppChannel } from '@/lib/notify/channels';
import type {
  SendWhatsAppDeps,
  WhatsAppSendResult,
} from '@/lib/notify/send-whatsapp-shared';
import { sendViaEum } from '@/lib/notify/send-whatsapp-eum';
import { sendDoubleTickMessage } from '@/lib/notify/send-whatsapp-doubletick';
import { orderedVariables } from '@/lib/notify/templates';
import type { NotifyEvent, NotifyRecipient, NotifyVariables } from '@/lib/notify/types';

/**
 * WhatsApp dispatcher — AWS End User Messaging (Social) by default, or DoubleTick when
 * `WHATSAPP_PROVIDER=doubletick` (receivables v2). With DoubleTick the same approved template name
 * is sent with the event's variables as positional placeholders.
 *
 * Same shape as the email dispatcher (`send-email.ts`): the guards run here,
 * once, and the transport only ever receives a resolved phone number and an
 * approved Meta template name.
 *
 * Contract: this NEVER throws and NEVER blocks email. Every outcome — queued,
 * skipped or failed — comes back as a value the caller writes to
 * `notification_deliveries`. A missing origination number mirrors the email
 * dispatcher's console-skip so local dev and CI never send.
 */

export type {
  WhatsAppSendResult,
  SendWhatsAppDeps,
} from '@/lib/notify/send-whatsapp-shared';

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

  if (config.provider === 'doubletick') {
    const res = await sendDoubleTickMessage({ to: decision.toPhone, templateName: decision.templateRef, variables: orderedVariables(input.event, input.variables) });
    if (res.ok === false) return { ok: false, status: 'failed', error: res.error, errorCode: res.permanent ? 'permanent' : 'transient', templateRef: decision.templateRef, toPhone: decision.toPhone };
    return { ok: true, status: 'queued', providerMessageId: res.messageId ?? '', templateRef: decision.templateRef, toPhone: decision.toPhone };
  }

  return sendViaEum(shared);
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
