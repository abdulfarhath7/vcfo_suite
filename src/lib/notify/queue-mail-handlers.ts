import 'server-only';

import { systemListProfilesForMail } from '@/db/repositories/profiles';
import { firstNameOf } from '@/lib/notify/templates';
import type { NotifyEvent, NotifyVariables } from '@/lib/notify/types';
import { queueWhatsAppSends } from '@/lib/notify/send-whatsapp';

type MailHandlerInput = {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
};

/**
 * Queue one WhatsApp note for each person a mail was addressed to.
 *
 * A handler with a user id is used directly. An address alone is matched to
 * a profile. Anyone with no account, no number, or no consent is skipped
 * later by the send job. Never throws, and never includes a password.
 */
export async function queueWhatsAppForMailHandlers(input: {
  engagementId: string | null;
  event: NotifyEvent;
  variables: NotifyVariables;
  handlers: MailHandlerInput[];
  /** Per-person Inngest event id, so a repeat on the same day is dropped. */
  dedupeIdFor?: (recipientProfileId: string) => string;
}): Promise<void> {
  try {
    const pending: Array<{ userId: string; name: string }> = [];
    const seen = new Set<string>();
    const needLookup: string[] = [];

    const push = (userId: string, name: string) => {
      if (!userId || seen.has(userId)) return;
      seen.add(userId);
      pending.push({ userId, name });
    };

    for (const handler of input.handlers) {
      const userId = handler.userId?.trim();
      if (userId) {
        push(userId, handler.name?.trim() || '');
        continue;
      }
      const email = handler.email?.trim().toLowerCase();
      if (email) needLookup.push(email);
    }

    if (needLookup.length > 0) {
      const found = await systemListProfilesForMail(needLookup);
      for (const row of found) push(row.profileId, row.name);
    }

    const shared = { ...input.variables };
    delete shared.firstName;
    await queueWhatsAppSends(
      pending.map((party) => ({
        engagementId: input.engagementId,
        recipientProfileId: party.userId,
        event: input.event,
        variables: {
          ...shared,
          firstName: firstNameOf(party.name),
        },
        ...(input.dedupeIdFor ? { dedupeId: input.dedupeIdFor(party.userId) } : {}),
      })),
    );
  } catch (err) {
    console.error('[whatsapp] mail handlers failed', input.event, err);
  }
}
