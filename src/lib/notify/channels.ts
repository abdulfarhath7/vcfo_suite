import {
  isNotifyEvent,
  type NotifyEvent,
  type NotifyRecipient,
  type SkipReason,
} from '@/lib/notify/types';
import {
  readTemplateNames,
  readTemplateSids,
  type TemplateNameMap,
  type TemplateSidMap,
} from '@/lib/notify/templates';
import { isValidE164 } from '@/lib/notify/phone';

/**
 * Phone helpers live in `@/lib/notify/phone` so client components can import
 * them without pulling in `readWhatsAppConfig` and the provider credentials it
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
 * PURE — no db, no provider SDK, no env reads. Config is passed in so the
 * guards can be exercised directly. `resolveWhatsAppChannel` never throws and
 * never returns a partial result: either it is a send with a template
 * reference and a phone, or it is a skip with a reason that goes straight onto
 * the delivery row. The same guards serve every transport.
 *
 * Email is resolved separately and is never gated by any of this — a WhatsApp
 * skip or failure must not touch the email path.
 */

/**
 * `aws_eum` bills the Meta message fee on the AWS invoice alongside SES, RDS
 * and S3; `twilio` is the legacy fallback and stays selectable indefinitely.
 */
export type WhatsAppProvider = 'aws_eum' | 'twilio';

/**
 * Defaults to `twilio`. The EUM path needs a registered origination phone
 * number id, so defaulting to it before the WABA is linked would turn every
 * send into a `disabled` skip. Flip the default with the number id.
 */
export function resolveWhatsAppProvider(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppProvider {
  const raw = (env.WHATSAPP_PROVIDER ?? 'twilio').trim().toLowerCase();
  return raw === 'aws_eum' ? 'aws_eum' : 'twilio';
}

/** AWS End User Messaging (Social) settings. Credentials come from the instance role. */
export type EumConfig = {
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
  /** Which transport `sendWhatsAppTemplate` dispatches to. */
  provider: WhatsAppProvider;
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
  /**
   * Event → template reference. Twilio Content Template SIDs today; the EUM
   * branch adds Meta template names beside them.
   */
  templateSids: TemplateSidMap;
  eum: EumConfig;
};

/**
 * The template reference for this provider + event, or '' when none resolves.
 * Twilio needs a configured Content SID; EUM defaults to the event name.
 */
export function templateRefFor(
  config: WhatsAppConfig,
  event: NotifyEvent,
): string {
  if (config.provider === 'aws_eum') {
    return config.eum.templateNames[event]?.trim() ?? '';
  }
  return config.templateSids[event]?.trim() ?? '';
}

export type ChannelDecision =
  /**
   * `templateRef` is provider-neutral: a Twilio Content Template SID, or an
   * approved Meta template name for AWS End User Messaging. The guards do not
   * care which — they only care that one is configured for the event.
   */
  | { send: true; toPhone: string; templateRef: string }
  | { send: false; skipReason: SkipReason };

/**
 * Kill switch on and the selected provider actually able to send.
 *
 * EUM needs no credentials here — it authenticates through the App Runner /
 * ECS instance role, exactly like `sendViaSes` — so the only hard requirement
 * is the registered origination phone number id.
 */
export function isWhatsAppConfigured(config: WhatsAppConfig): boolean {
  if (!config.enabled) return false;

  if (config.provider === 'aws_eum') {
    return Boolean(config.eum.phoneNumberId.trim());
  }

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
    provider: resolveWhatsAppProvider(env),
    accountSid: env.TWILIO_ACCOUNT_SID?.trim() ?? '',
    authToken: env.TWILIO_AUTH_TOKEN?.trim() ?? '',
    from: env.TWILIO_WHATSAPP_FROM?.trim() ?? '',
    messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID?.trim() ?? '',
    statusCallbackUrl: env.TWILIO_STATUS_CALLBACK_URL?.trim() ?? '',
    inboundCallbackUrl: env.TWILIO_INBOUND_CALLBACK_URL?.trim() ?? '',
    templateSids: readTemplateSids(env),
    eum: {
      region: env.SOCIAL_MESSAGING_REGION?.trim() || env.AWS_REGION?.trim() || '',
      phoneNumberId: env.EUM_PHONE_NUMBER_ID?.trim() ?? '',
      templateLanguage: env.WHATSAPP_TEMPLATE_LANG?.trim() || 'en',
      metaApiVersion: env.META_API_VERSION?.trim() || 'v21.0',
      templateNames: readTemplateNames(env),
    },
  };
}
