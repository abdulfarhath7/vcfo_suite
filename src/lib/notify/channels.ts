import {
  isNotifyEvent,
  type NotifyEvent,
  type NotifyRecipient,
  type SkipReason,
} from '@/lib/notify/types';
import { readTemplateNames, type TemplateNameMap } from '@/lib/notify/templates';
import { isValidE164, normalizeToE164 } from '@/lib/notify/phone';

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

/**
 * Which transport sends. Mirrors EMAIL_PROVIDER: one switch, both kept.
 *   eum        — AWS End User Messaging (Social); bills on the AWS invoice
 *   doubletick — DoubleTick API on SBC's existing WhatsApp Business number
 */
export type WhatsAppProvider = 'eum' | 'doubletick';

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

/** DoubleTick settings. The API key is a secret: env / Secrets Manager only. */
type DoubleTickConfig = {
  /** Sent as the raw `Authorization` header (no "Bearer"). Never logged. */
  apiKey: string;
  /** The WhatsApp Business number, bare digits with country code (919014079600). */
  fromNumber: string;
  /** API origin; overridable only so a test can point elsewhere. */
  baseUrl: string;
  /** Approved template language, e.g. `en`. */
  templateLanguage: string;
  /** Approved template name per event; defaults to `vcfo_<event>`. */
  templateNames: TemplateNameMap;
};

export type WhatsAppConfig = {
  enabled: boolean;
  provider: WhatsAppProvider;
  eum: EumConfig;
  doubletick: DoubleTickConfig;
  /**
   * Rollout list (E.164). Empty = no restriction. While it holds numbers,
   * only those numbers are messaged; everyone else is skipped `not_allowlisted`.
   */
  allowlist: string[];
};

/** The approved template name for this event on the active provider, or ''. */
export function templateRefFor(
  config: WhatsAppConfig,
  event: NotifyEvent,
): string {
  const names =
    config.provider === 'doubletick' ? config.doubletick.templateNames : config.eum.templateNames;
  return names[event]?.trim() ?? '';
}

export type ChannelDecision =
  /** `templateRef` is the approved Meta template name for the event. */
  | { send: true; toPhone: string; templateRef: string }
  | { send: false; skipReason: SkipReason };

/**
 * Kill switch on and the active provider able to send.
 *
 * EUM needs no credentials here — it authenticates through the App Runner /
 * ECS instance role, exactly like `sendViaSes` — so its only requirement is
 * the registered origination phone number id. DoubleTick needs its API key
 * and the business number it sends from.
 */
export function isWhatsAppConfigured(config: WhatsAppConfig): boolean {
  if (!config.enabled) return false;
  if (config.provider === 'doubletick') {
    return config.doubletick.apiKey.trim() !== '' && config.doubletick.fromNumber.trim() !== '';
  }
  return config.eum.phoneNumberId.trim() !== '';
}

/**
 * Guard order is deliberate:
 *   1 disabled        — kill switch / provider not set up wins over everything
 *   2 no_template     — event not chosen, or no template name resolves for it
 *   3 no_phone        — nothing to send to
 *   4 no_consent      — never opted in (reported before opt-out, so a person who
 *                       never consented does not read as "opted_out")
 *   5 opted_out       — consented once, then sent STOP
 *   6 not_allowlisted — otherwise sendable, but the rollout list leaves them out
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

  if (config.allowlist.length > 0 && !config.allowlist.includes(phone)) {
    return { send: false, skipReason: 'not_allowlisted' };
  }

  return { send: true, toPhone: phone, templateRef };
}

/** `eum` unless WHATSAPP_PROVIDER names another known provider. */
function readProvider(raw: string | undefined): WhatsAppProvider {
  return raw?.trim().toLowerCase() === 'doubletick' ? 'doubletick' : 'eum';
}

/**
 * WHATSAPP_ALLOWLIST_E164 — comma / space separated. Each entry is normalised
 * to E.164; an entry that cannot be read is dropped (and so cannot widen the
 * list). A list whose every entry is unreadable would become "no restriction",
 * so in that case it keeps a sentinel that matches no real number.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  const entries = (raw ?? '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) return [];
  const numbers = entries
    .map((entry) => normalizeToE164(entry))
    .filter((n): n is string => Boolean(n));
  return numbers.length > 0 ? [...new Set(numbers)] : ['+0'];
}

/** Server-side only — never import this from a client component. */
export function readWhatsAppConfig(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppConfig {
  const templateLanguage = env.WHATSAPP_TEMPLATE_LANG?.trim() || 'en';
  return {
    enabled: (env.WHATSAPP_ENABLED ?? '').trim().toLowerCase() === 'true',
    provider: readProvider(env.WHATSAPP_PROVIDER),
    eum: {
      region: env.SOCIAL_MESSAGING_REGION?.trim() || env.AWS_REGION?.trim() || '',
      phoneNumberId: env.EUM_PHONE_NUMBER_ID?.trim() ?? '',
      templateLanguage,
      metaApiVersion: env.META_API_VERSION?.trim() || 'v21.0',
      templateNames: readTemplateNames(env),
    },
    doubletick: {
      apiKey: env.DOUBLETICK_API_KEY?.trim().replace(/^"|"$/g, '') ?? '',
      fromNumber: (env.DOUBLETICK_FROM_NUMBER ?? '').replace(/\D/g, ''),
      baseUrl: (env.DOUBLETICK_BASE_URL?.trim() || 'https://public.doubletick.io').replace(/\/+$/, ''),
      templateLanguage,
      templateNames: readTemplateNames(
        env,
        env.DOUBLETICK_TEMPLATE_PREFIX === undefined ? 'vcfo_' : env.DOUBLETICK_TEMPLATE_PREFIX.trim(),
      ),
    },
    allowlist: parseAllowlist(env.WHATSAPP_ALLOWLIST_E164),
  };
}
