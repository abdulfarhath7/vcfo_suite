import type { EngagementProcessEvent } from '@/lib/email/engagement-event-fanout';
import type { NotifyEvent } from '@/lib/notify/types';

/**
 * Process email → WhatsApp template. PURE, so the mapping is testable without
 * the fan-out's db and mail imports.
 *
 * WhatsApp follows the email: same event, same people (`mailHandlersForEvent`).
 * Events with their own approved template use it; every other process email
 * falls back to `process_notice` with a short line.
 */

/** Certificate of Incorporation step — accepting it is the `coi_issued` nudge. */
export const COI_ITEM_ID = 'pre-12';

const DEDICATED: Partial<Record<EngagementProcessEvent, NotifyEvent>> = {
  delivered: 'document_delivered',
  step_awaiting_client_approval: 'step_awaiting_approval',
  phase_approved: 'phase_approved',
  // The client is asked to fill a step once the manager approves the lead's ask.
  client_fill_approved: 'client_action_needed',
  docs_shared: 'documents_shared',
  client_submitted: 'staff_client_submitted',
  client_uploaded: 'staff_client_uploaded',
  client_change_requested: 'staff_change_requested',
};

/** Short line for a `process_notice`. No note text, no document contents. */
export function processNoticeLine(event: EngagementProcessEvent, title: string): string | null {
  switch (event) {
    case 'client_submitted':
      return `${title} was submitted for review`;
    case 'client_uploaded':
      return `a file was added on ${title}`;
    case 'lead_requested_review':
      return `${title} is waiting for manager approval`;
    case 'review_accepted':
      return `${title} was accepted`;
    case 'review_rejected':
      return `${title} needs a correction`;
    case 'unlocked':
      return `${title} is open for updates`;
    case 'docs_shared':
      return 'incorporation drafts are ready';
    case 'board_resolution_shared':
      return 'the board resolution is ready';
    case 'request_created':
      return `a document was requested on ${title}`;
    case 'client_fill_requested':
      return `${title} is waiting for approval before the client is asked`;
    case 'client_fill_approved':
      return `please fill ${title}`;
    case 'client_fill_declined':
      return `${title} was not sent to the client`;
    case 'step_awaiting_client_approval':
      return `${title} is ready for your approval`;
    case 'phase_approved':
      return `${title} was approved`;
    case 'client_change_requested':
      return `a change was requested on ${title}`;
    case 'delivered':
      return null;
  }
}

export type WhatsAppNotice = { event: NotifyEvent; stepTitle?: string };

/**
 * The WhatsApp template for one process email, or null for none.
 * A portal-only refresh (`inAppOnly`) sends no email, and a re-opened compose
 * (`skipInAppNotifications`) already sent it once — neither sends WhatsApp.
 */
export function whatsappEventFor(
  input: {
    event: EngagementProcessEvent;
    itemId: string;
    inAppOnly?: boolean;
    skipInAppNotifications?: boolean;
  },
  title: string,
): WhatsAppNotice | null {
  if (input.inAppOnly || input.skipInAppNotifications) return null;
  if (input.event === 'review_accepted' && input.itemId.trim() === COI_ITEM_ID) {
    return { event: 'coi_issued' };
  }
  const dedicated = DEDICATED[input.event];
  if (dedicated) return { event: dedicated, stepTitle: title };
  const line = processNoticeLine(input.event, title);
  return line ? { event: 'process_notice', stepTitle: line } : null;
}

/**
 * At-most-once per (event, engagement, step, person, day): a double click or a
 * re-run on the same day reuses the Inngest event id, which Inngest drops.
 */
export function whatsappDedupeId(parts: {
  event: NotifyEvent;
  engagementId: string;
  itemId: string;
  recipientProfileId: string;
  at?: Date;
}): string {
  const day = (parts.at ?? new Date()).toISOString().slice(0, 10);
  return ['wa', parts.event, parts.engagementId, parts.itemId || '-', parts.recipientProfileId, day].join(':');
}
