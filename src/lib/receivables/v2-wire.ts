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

export type EmailKind = 'new_invoice' | 'revised' | 'rollup' | 'digest' | 'client_statement' | 'payment_received';

/** The "Payment received" email offered after Mark received (never sent on its own). */
export type ReceivedEmailDraftDto = { invoiceIds: string[]; subject: string; html: string; to: Array<{ name: string; email: string }>; contacts: Array<{ name: string; email: string }> };
export type EmailStatus = 'sending' | 'sent' | 'failed' | 'skipped';
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
};

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
