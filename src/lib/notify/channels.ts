import {
  isNotifyEvent,
  type NotifyEvent,
  type NotifyRecipient,
  type SkipReason,
} from '@/lib/notify/types';
import { readTemplateNames, type TemplateNameMap } from '@/lib/notify/templates';
import { isValidE164 } from '@/lib/notify/phone';

/**
 * Phone helpers live in `@/lib/notify/phone` so client components can import
 * them without pulling in `readWhatsAppConfig`. Re-exported here for server
 * callers already importing this module.
 */
export { fromMetaPhone, isOptOutKeyword } from '@/lib/notify/phone';

/**
 * Channel resolution for one recipient + one event.
 *
 * PURE — no db, no provider SDK, no env reads. Config is passed in so the
 * guards can be exercised directly. `resolveWhatsAppChannel` never throws and
 * never returns a partial result: either it is a send with a template
 * reference and a phone, or it is a skip with a reason that goes straight onto
 * the delivery row.
 *
 * Email is resolved separately and is never gated by any of this — a WhatsApp
 * skip or failure must not touch the email path.
 */

/** AWS End User Messaging (Social) settings. Credentials come from the instance role. */
type EumConfig = {
  /** Falls back to AWS_REGION. Must be a region where EUM Social is available. */
  region: string;
  /** `phone-number-id-…` from the EUM console. Without it, nothing can send. */
  phoneNumberId: string;
  /** Approved template language, e.g. `en`. */
  templateLanguage: string;
  /** Pinned Meta Cloud API version, e.g. `v21.0`. */
  metaApiVersion: string;
  /** Approved template name per event; defaults to the event name. */
  templateNames: TemplateNameMap;
};

export type WhatsAppConfig = {
  enabled: boolean;
  eum: EumConfig;
};

/** The approved Meta template name for this event, or '' when none resolves. */
export function templateRefFor(
  config: WhatsAppConfig,
  event: NotifyEvent,
): string {
  return config.eum.templateNames[event]?.trim() ?? '';
}

export type ChannelDecision =
  /** `templateRef` is the approved Meta template name for the event. */
  | { send: true; toPhone: string; templateRef: string }
  | { send: false; skipReason: SkipReason };

/**
 * Kill switch on and able to send.
 *
 * EUM needs no credentials here — it authenticates through the App Runner /
 * ECS instance role, exactly like `sendViaSes` — so the only hard requirement
 * is the registered origination phone number id.
 */
export function isWhatsAppConfigured(config: WhatsAppConfig): boolean {
  return config.enabled && config.eum.phoneNumberId.trim() !== '';
}

/**
 * Guard order is deliberate:
 *   1 disabled      — kill switch / missing number id wins over everything
 *   2 no_template   — event not chosen, or no template name resolves for it
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

  const templateRef = templateRefFor(config, event as NotifyEvent);
  if (!templateRef) {
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

  return { send: true, toPhone: phone, templateRef };
}

/** Server-side only — never import this from a client component. */
export function readWhatsAppConfig(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppConfig {
  return {
    enabled: (env.WHATSAPP_ENABLED ?? '').trim().toLowerCase() === 'true',
    eum: {
      region: env.SOCIAL_MESSAGING_REGION?.trim() || env.AWS_REGION?.trim() || '',
      phoneNumberId: env.EUM_PHONE_NUMBER_ID?.trim() ?? '',
      templateLanguage: env.WHATSAPP_TEMPLATE_LANG?.trim() || 'en',
      metaApiVersion: env.META_API_VERSION?.trim() || 'v21.0',
      templateNames: readTemplateNames(env),
    },
  };
}
