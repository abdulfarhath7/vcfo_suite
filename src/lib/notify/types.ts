/**
 * Outbound notification channel types.
 *
 * WhatsApp is a *nudge* channel that runs alongside email — email stays the
 * system of record. Every message body is a pre-approved Twilio Content
 * Template referenced by SID; nothing here ever builds a free-form body.
 *
 * ADDING AN EVENT: append to `NOTIFY_EVENTS`, add the variable builder in
 * `templates.ts`, and set `WHATSAPP_TEMPLATE_<UPPER_SNAKE>` in the env. No
 * other file changes (the DB columns are text, not enums, on purpose).
 */

/** Chosen events. All Meta category "utility", all outbound-only. */
export const NOTIFY_EVENTS = [
  'welcome',
  'coi_issued',
  'document_delivered',
  'compliance_due_monthly',
  'compliance_due_quarterly',
  'compliance_overdue',
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
  | 'disabled';

/**
 * WhatsApp delivery status ownership on the profile.
 * `failed` is set by the status webhook on a hard bounce so staff can see it.
 */
export type WhatsAppStatus = 'unknown' | 'verified' | 'failed';

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
