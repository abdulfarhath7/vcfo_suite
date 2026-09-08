import type { WhatsAppConfig } from '@/lib/notify/channels';
import type { SkipReason } from '@/lib/notify/types';

/**
 * The provider switch itself lives in `channels.ts` beside the config it
 * selects; re-exported here so transports have one import for the pieces they
 * share.
 */
export {
  resolveWhatsAppProvider,
  type WhatsAppProvider,
} from '@/lib/notify/channels';

/**
 * Transport-neutral pieces shared by the WhatsApp dispatcher and both
 * transports. Mirrors `send-email-shared.ts`, and exists for the same reason:
 * the dispatcher imports the transports, so anything both sides need lives in
 * a third module rather than creating an import cycle.
 */

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
