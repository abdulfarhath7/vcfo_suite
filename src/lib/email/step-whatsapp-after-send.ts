import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getItem } from '@/data/checklist';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { isStepWhatsAppEvent } from '@/lib/email/email-dispatch';
import { queueWhatsAppSends } from '@/lib/notify/send-whatsapp';
import { firstNameOf } from '@/lib/notify/templates';

/*
 * GL-07, owner decision "WhatsApp goes out only after the email". A step event whose client
 * email is a draft (the "Send email" pop-up) carries the WhatsApp event on that draft. The nudge
 * is queued here, from the send routes, only once the email has actually gone out, and only to
 * the clients the email reached. It is never queued when the event happens.
 */

/**
 * Queue the client WhatsApp nudge for a drafted step email that was just sent. It never throws:
 * a failure is logged and the email, already sent, is untouched. The variables are the same ones
 * the event used to send (first name, company name, step title), worked out again on the server
 * so the browser cannot change the template text.
 */
export async function queueStepWhatsAppAfterSend(
  ctx: AuthContext,
  input: {
    whatsappEvent?: string;
    engagementId?: string;
    itemId?: string;
    /** Addresses the email was accepted for (To and CC). */
    sentTo: string[];
  },
): Promise<void> {
  try {
    const { whatsappEvent, engagementId, itemId } = input;
    if (!engagementId || !itemId || !isStepWhatsAppEvent(whatsappEvent, itemId)) return;
    if (input.sentTo.length === 0) return;

    const access = await assertEngagementAccess(ctx, engagementId);
    if (!access.ok) return;
    const recipients = await resolveEngagementRecipients(engagementId);
    if (!recipients) return;

    const reached = new Set(input.sentTo.map((a) => a.trim().toLowerCase()));
    const clients = recipients.clients.length > 0 ? recipients.clients : recipients.client ? [recipients.client] : [];
    const nudged = clients.filter((party) => reached.has(party.email.trim().toLowerCase()));
    if (nudged.length === 0) return;

    const stepTitle = getItem(itemId)?.title ?? itemId;
    await queueWhatsAppSends(
      nudged.map((party) => ({
        engagementId: recipients.appId,
        recipientProfileId: party.userId,
        event: whatsappEvent,
        variables: {
          firstName: firstNameOf(party.name),
          companyName: recipients.companyName,
          stepTitle,
        },
        // A second click of Send for the same step does not message the client twice.
        dedupeId: `step-email:${whatsappEvent}:${recipients.dbId}:${itemId}:${party.userId}`,
      })),
    );
  } catch (err) {
    console.error('[whatsapp] step nudge after send failed', input.whatsappEvent, err);
  }
}
