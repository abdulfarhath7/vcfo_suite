import type { WhatsAppConfig } from '@/lib/notify/channels';
import type { SkipReason } from '@/lib/notify/types';

/**
 * Pieces shared by the WhatsApp dispatcher and the EUM transport. Mirrors
 * `send-email-shared.ts`, and exists for the same reason: the dispatcher
 * imports the transport, so anything both sides need lives in a third module
 * rather than creating an import cycle.
 */

/**
 * The result contract the transport returns. NEVER an exception: sent,
 * skipped and failed are all values the caller writes to
 * `notification_deliveries`.
 *
 * `templateRef` is the approved Meta template name. It lands in the
 * `template_sid` column; the column is text and only ever held a template
 * reference.
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

/**
 * `SendWhatsAppMessageCommand`'s input, narrowed to what this feature sends.
 * Declared structurally so a unit test can stub it without the AWS SDK.
 */
export type EumSendMessage = (params: {
  originationPhoneNumberId: string;
  metaApiVersion: string;
  message: Uint8Array;
}) => Promise<{ messageId?: string }>;

/**
 * Test seams. The client factory is injected rather than constructed at
 * module scope, so a unit test never needs credentials and no SDK is loaded
 * until a send actually happens.
 */
export type SendWhatsAppDeps = {
  config?: WhatsAppConfig;
  createEumClient?: (config: WhatsAppConfig) => Promise<EumSendMessage>;
};
