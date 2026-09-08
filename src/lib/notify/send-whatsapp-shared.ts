import type { WhatsAppConfig } from '@/lib/notify/channels';
import type { SkipReason } from '@/lib/notify/types';

/**
 * Transport-neutral pieces shared by the WhatsApp dispatcher and both
 * transports. Mirrors `send-email-shared.ts`, and exists for the same reason:
 * the dispatcher imports the transports, so anything both sides need lives in
 * a third module rather than creating an import cycle.
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

/**
 * The result contract every transport returns. NEVER an exception: sent,
 * skipped and failed are all values the caller writes to
 * `notification_deliveries`.
 *
 * `templateRef` is provider-neutral — a Twilio Content Template SID or an
 * approved Meta template name. It lands in the `template_sid` column either
 * way; the column is text and never held a Twilio-only meaning.
 */
export type WhatsAppSendResult =
  | {
      ok: true;
      status: 'queued';
      providerMessageId: string;
      templateRef: string;
      toPhone: string;
    }
  | {
      ok: false;
      status: 'skipped';
      skipReason: SkipReason;
      templateRef?: string;
      toPhone?: string;
    }
  | {
      ok: false;
      status: 'failed';
      error: string;
      errorCode?: string;
      templateRef?: string;
      toPhone?: string;
    };

/** Twilio's `messages.create`, narrowed to what this feature sends. */
export type TwilioMessageCreate = (params: {
  to: string;
  contentSid: string;
  contentVariables: string;
  from?: string;
  messagingServiceSid?: string;
  statusCallback?: string;
}) => Promise<{ sid: string }>;

/**
 * Test seams. Both client factories are injected rather than constructed at
 * module scope, so a unit test never needs credentials and no SDK is loaded
 * until a send actually happens.
 */
export type SendWhatsAppDeps = {
  config?: WhatsAppConfig;
  /** Twilio path only. */
  createClient?: (config: WhatsAppConfig) => Promise<TwilioMessageCreate>;
};
