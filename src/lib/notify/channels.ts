import {
  isNotifyEvent,
  type NotifyEvent,
  type NotifyRecipient,
  type SkipReason,
} from '@/lib/notify/types';
import { readTemplateSids, type TemplateSidMap } from '@/lib/notify/templates';
import { isValidE164 } from '@/lib/notify/phone';

/**
 * Phone helpers live in `@/lib/notify/phone` so client components can import
 * them without pulling in `readWhatsAppConfig` and the Twilio credentials it
 * reads. Re-exported here for server callers already importing this module.
 */
export {
  isValidE164,
  normalizeToE164,
  stripWhatsAppPrefix,
  withWhatsAppPrefix,
  isOptOutKeyword,
} from '@/lib/notify/phone';

/**
 * Channel resolution for one recipient + one event.
 *
 * PURE — no db, no Twilio, no env reads. Config is passed in so the guards can
 * be exercised directly. `resolveWhatsAppChannel` never throws and never
 * returns a partial result: either it is a send with a template SID and a
 * phone, or it is a skip with a reason that goes straight onto the delivery row.
 *
 * Email is resolved separately and is never gated by any of this — a WhatsApp
 * skip or failure must not touch the email path.
 */

export type WhatsAppConfig = {
  enabled: boolean;
  accountSid: string;
  authToken: string;
  /** `whatsapp:+1555...` sender, used when no messaging service is set. */
  from: string;
  messagingServiceSid: string;
  statusCallbackUrl: string;
  /**
   * Public URL of the inbound webhook, used only to validate its signature.
   * Signature validation must use the URL Twilio signed, and the inbound path
   * differs from the status path — so it cannot reuse `statusCallbackUrl`.
   */
  inboundCallbackUrl: string;
  templateSids: TemplateSidMap;
};

export type ChannelDecision =
  | { send: true; toPhone: string; templateSid: string }
  | { send: false; skipReason: SkipReason };

/** Credentials present and the kill switch on. */
export function isWhatsAppConfigured(config: WhatsAppConfig): boolean {
  if (!config.enabled) return false;
  if (!config.accountSid.trim() || !config.authToken.trim()) return false;
  // One of the two sender forms must be set.
  return Boolean(config.messagingServiceSid.trim() || config.from.trim());
}

/**
 * Guard order is deliberate:
 *   1 disabled      — kill switch / missing credentials wins over everything
 *   2 no_template   — event not chosen, or no SID configured for it
 *   3 no_phone      — nothing to send to
 *   4 no_consent    — never opted in (reported before opt-out, so a person who
 *                     never consented does not read as "opted_out")
 *   5 opted_out     — consented once, then sent STOP
 */
export function resolveWhatsAppChannel(input: {
  recipient: NotifyRecipient;
  event: string;
  config: WhatsAppConfig;
}): ChannelDecision {
  const { recipient, event, config } = input;

  if (!isWhatsAppConfigured(config)) {
    return { send: false, skipReason: 'disabled' };
  }

  if (!isNotifyEvent(event)) {
    return { send: false, skipReason: 'no_template' };
  }

  const templateSid = config.templateSids[event as NotifyEvent]?.trim();
  if (!templateSid) {
    return { send: false, skipReason: 'no_template' };
  }

  const phone = recipient.phoneE164?.trim() ?? '';
  if (!isValidE164(phone)) {
    return { send: false, skipReason: 'no_phone' };
  }

  if (!recipient.whatsappOptInAt) {
    return { send: false, skipReason: 'no_consent' };
  }

  if (recipient.whatsappOptOutAt) {
    return { send: false, skipReason: 'opted_out' };
  }

  return { send: true, toPhone: phone, templateSid };
}

/** Server-side only — never import this from a client component. */
export function readWhatsAppConfig(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppConfig {
  return {
    enabled: (env.WHATSAPP_ENABLED ?? '').trim().toLowerCase() === 'true',
    accountSid: env.TWILIO_ACCOUNT_SID?.trim() ?? '',
    authToken: env.TWILIO_AUTH_TOKEN?.trim() ?? '',
    from: env.TWILIO_WHATSAPP_FROM?.trim() ?? '',
    messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID?.trim() ?? '',
    statusCallbackUrl: env.TWILIO_STATUS_CALLBACK_URL?.trim() ?? '',
    inboundCallbackUrl: env.TWILIO_INBOUND_CALLBACK_URL?.trim() ?? '',
    templateSids: readTemplateSids(env),
  };
}
