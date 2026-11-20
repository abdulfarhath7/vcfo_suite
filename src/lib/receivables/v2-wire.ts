import type { TemplateOverride } from './templates';
import type { ReceivedInvoice } from './email-v2';
import type { SentMap } from './sent-receipts';
/**
 * RECEIVABLES v2 WIRE — the JSON of the Tally import, the approval panel and the People tab
 * (docs/specs/receivables/V2.md). Timestamps arrive as ISO strings.
 */

export type ClientDto = {
  id: string;
  name: string;
  gstin: string | null;
  creditDays: number;
  billingEmail: string | null;
  billingCc: string[];
  partnerId: string | null;
  /** Second partners (owner, 18 Nov 2026): they share every invoice of the client. The lead is not in it. */
  coPartnerIds: string[];
  active: boolean;
  /** The open balance of the client's live invoices, in INR. */
  openAmount: number;
  openCount: number;
};

export type DigestRecipientDto = { id: string; name: string; email: string; active: boolean };

/**
 * `matched`: an invoice with no number (loaded from the weekly workbook) that a Tally row matched by
 * client and amount; approving it fills in the Tally invoice number and date.
 */
export type ImportRowKind = 'new' | 'changed' | 'same' | 'no_partner' | 'matched';
export type ImportRowStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

export type ImportRowDto = {
  id: string;
  batchId: string | null;
  kind: ImportRowKind;
  source: 'tally' | 'staff';
  invoiceId: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  clientName: string;
  clientId: string | null;
  partnerId: string | null;
  gstin: string | null;
  amountInr: number;
  oldAmountInr: number | null;
  dueDate: string | null;
  /** The client's credit days today (the due date is worked out from them). */
  creditDays: number;
  reason: string | null;
  requestedByName: string | null;
  createdAt: string;
};

export type ImportBatchDto = {
  id: string;
  fileName: string;
  company: string;
  period: string;
  uploadedByName: string | null;
  createdAt: string;
  rowCount: number;
  newCount: number;
  changedCount: number;
  sameCount: number;
  noPartnerCount: number;
  /** Rows matched by client and amount (counted from the rows, not stored). */
  matchedCount: number;
};

/** Everything the approval panel shows: the pending batch (if any) and every pending row. */
export type PendingImportsDto = { batch: ImportBatchDto | null; rows: ImportRowDto[]; warnings?: string[] };

/** One row's edits at approval: the due date, the client's credit days and, for a client with no partner, the partner. */
export type ApproveEdit = { rowId: string; dueDate?: string; creditDays?: number; partnerId?: string | null };

export type ApproveResultDto = { approved: number; invoiceIds: string[]; refused: Array<{ rowId: string; code: string }> };

/** `summary` is the Send email on the Sheet tab, logged here from 19 Nov 2026. */
export type EmailKind = 'new_invoice' | 'revised' | 'rollup' | 'digest' | 'client_statement' | 'payment_received' | 'summary' | 'collections';

/**
 * Automatic emails go out without anyone clicking Send: after an approval (new invoice, revised)
 * or on a schedule (roll-up, digest). Every other kind is a person's own send.
 */
export const AUTO_EMAIL_KINDS: readonly EmailKind[] = ['new_invoice', 'revised', 'rollup', 'digest'];
export const MANUAL_EMAIL_KINDS: readonly EmailKind[] = ['summary', 'collections', 'payment_received', 'client_statement'];
export const isAutoEmail = (k: EmailKind) => AUTO_EMAIL_KINDS.includes(k);

/** The "Payment received" email offered after Mark received (never sent on its own). */
export type ReceivedEmailDraftDto = {
  invoiceIds: string[];
  subject: string;
  html: string;
  to: Array<{ name: string; email: string }>;
  contacts: Array<{ name: string; email: string }>;
  /** The invoices, so the pop-up can rebuild the body when one is removed (owner, 18 Nov 2026). */
  invoices: Array<ReceivedInvoice & { id: string }>;
  recipientName: string;
  /** The sheet's saved words for this email (the Templates tab), used when the body is rebuilt. */
  template?: TemplateOverride;
  today?: string;
  /** Who each invoice was already sent to, and when. */
  alreadySent: SentMap;
};
/** `awaiting`: an automatic email waiting for someone to approve it (owner, 20 Nov 2026); nothing is sent until then. */
export type EmailStatus = 'awaiting' | 'sending' | 'sent' | 'failed' | 'skipped';
export type WhatsAppPingStatus = 'sent' | 'failed' | 'no_phone' | 'disabled';

export type EmailLogDto = {
  id: string;
  kind: EmailKind;
  recipientName: string;
  to: string[];
  cc: string[];
  subject: string;
  senderName: string | null;
  status: EmailStatus;
  error: string | null;
  whatsappStatus: WhatsAppPingStatus | null;
  createdAt: string;
  sentAt: string | null;
  /** How many invoices the email holds. */
  invoiceCount?: number;
  /** The Outlook account it went from (the sender's connected address) and the WhatsApp number its ping went to. */
  senderEmail?: string | null;
  senderPhone?: string | null;
};

/** The Email log tab's filters. */
export type EmailLogFilter = { origin?: 'auto' | 'manual'; kind?: EmailKind; status?: EmailStatus; q?: string };
/** One page of the Email log, newest first; `nextBefore` loads the older page. */
export type EmailLogPageDto = { rows: EmailLogDto[]; nextBefore: string | null };
/** One email in full, for the viewer. */
export type EmailLogEntryDto = EmailLogDto & { html: string; about: string; webLink: string | null };

/** The sheet's v2 email settings, edited on the People tab. */
export type EmailSettingsDto = {
  digestEnabled: boolean;
  digestWeekday: number;
  digestHourIst: number;
  rollupEveryDays: number;
  /** The weekdays the roll-up goes out on (0 = Sunday … 6 = Saturday). */
  rollupWeekdays: number[];
  sendHourIst: number;
  emailNewInvoiceEnabled: boolean;
  emailRollupEnabled: boolean;
  emailRevisedEnabled: boolean;
};

export type PeopleDto = {
  clients: ClientDto[];
  digestRecipients: DigestRecipientDto[];
  emailLog: EmailLogDto[];
  settings: EmailSettingsDto;
  /** ISO timestamps of the next automatic sends, or null while switched off. */
  nextRollupAt: string | null;
  nextDigestAt: string | null;
  /** The WhatsApp (DoubleTick) card. */
  whatsapp: { configured: boolean; missing: string[]; myPhone: string | null };
};
