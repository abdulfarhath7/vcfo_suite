import { isValidE164 } from '@/lib/notify/phone';

/** Pure rules for the client reminder (G-15); the send path is `send-client-reminder.ts`. */

export type WhatsAppConsent = 'opted_in' | 'no_phone' | 'no_consent' | 'opted_out';

/**
 * Whether a reminder may also go out on WhatsApp for this client. The order matches the
 * send-time guards in `src/lib/notify/channels.ts`, so a skipped row reads the same reason
 * the background job would have written.
 */
export function whatsappConsentOf(party: {
  phoneE164?: string | null;
  whatsappOptInAt?: Date | string | null;
  whatsappOptOutAt?: Date | string | null;
}): WhatsAppConsent {
  if (!isValidE164(party.phoneE164?.trim() ?? '')) return 'no_phone';
  if (!party.whatsappOptInAt) return 'no_consent';
  if (party.whatsappOptOutAt) return 'opted_out';
  return 'opted_in';
}

/** Item kinds a lead may remind the client about from Waiting on (the client holds them). */
export function remindableItemKey(item: { id: string; kind: string }): string | null {
  if (item.kind === 'waiting-client' && item.id.startsWith('step:')) return item.id;
  if (item.kind === 'waiting-request' && item.id.startsWith('request:')) return item.id;
  return null;
}
