/**
 * Outbound notification channel types.
 *
 * TRANSPORT-AGNOSTIC ON PURPOSE. WhatsApp ships over AWS End User Messaging
 * (Social) and nothing in this file may name the transport.
 *
 * WhatsApp is a *nudge* channel that runs alongside email — email stays the
 * system of record. Every message body is a pre-approved template referenced
 * by its Meta template name; nothing here ever builds a free-form body.
 *
 * ADDING AN EVENT: append to `NOTIFY_EVENTS` and add the variable builder in
 * `templates.ts`; the template name defaults to the event name (override
 * with `WHATSAPP_TEMPLATE_NAME_<UPPER_SNAKE>`). No other file changes (the
 * DB columns are text, not enums, on purpose).
 */

import type { WhatsAppGatePrefs } from '@/lib/notify/prefs-gate';

/** Chosen events. All Meta category "utility", all outbound-only. */
export const NOTIFY_EVENTS = [
  'welcome',
  'coi_issued',
  'document_delivered',
  'compliance_due_monthly',
  'compliance_due_quarterly',
  'compliance_overdue',
  // G-15: a staff "Remind" on an item the client still owes. Template body
  // variables: 1 company name, 2 item title.
  'client_reminder',
] as const;

export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

export function isNotifyEvent(value: string): value is NotifyEvent {
  return (NOTIFY_EVENTS as readonly string[]).includes(value);
}

export type NotifyChannel = 'email' | 'whatsapp';

export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'skipped';

export type SkipReason =
  | 'no_phone'
  | 'no_consent'
  | 'opted_out'
  | 'no_template'
  | 'disabled'
  /** The person switched this event's WhatsApp category off (G-25). */
  | 'muted'
  /** Inside the person's quiet hours; the background job waits instead (G-25). */
  | 'quiet_hours';

/**
 * The slice of a person the WhatsApp guards need.
 * Deliberately narrow so `channels.ts` stays a pure function.
 */
export type NotifyRecipient = {
  profileId: string;
  name: string;
  email: string;
  /** E.164, e.g. +919876543210. Null when the person never gave one. */
  phoneE164: string | null;
  whatsappOptInAt: Date | null;
  whatsappOptOutAt: Date | null;
  /**
   * The person's own WhatsApp categories and quiet hours (`notification_prefs`).
   * Absent or null means nothing was saved, so every category is on and there
   * are no quiet hours to respect.
   */
  prefs?: WhatsAppGatePrefs | null;
};

/**
 * Template variables. Short, non-sensitive values only —
 * never a CIN/PAN/TAN, filing number, password, OTP or document content.
 */
export type NotifyVariables = {
  firstName?: string;
  companyName?: string;
  stepTitle?: string;
  obligationName?: string;
  dueDate?: string;
};
