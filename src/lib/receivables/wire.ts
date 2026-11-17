/**
 * RECEIVABLES WIRE — the JSON the /api/receivables routes send to the manager area. Dates in
 * timestamps arrive as ISO strings.
 */
import type { EmailRecipient, Partner, ReminderRules, SheetInvoice, SnapshotRow } from './model';
import type { RateInForceDto } from './reports-wire';

export type SheetDto = {
  id: string;
  name: string;
  clientOrgName: string;
  requireKey: boolean;
  reminderRules: ReminderRules;
  publishedVersionId: string | null;
};

export type ManagerSheetDto = {
  sheet: SheetDto;
  partners: PartnerDto[];
  invoices: ManagerInvoiceDto[];
  unpublishedChanges: number;
  latestVersion: { id: string; seq: number; publishedAt: string; publishedByName: string } | null;
  /** The client partner page link (`/receivables`; the partners sign in there). */
  publicUrl: string;
  /** Phase 9: the USD rate in force today (or the latest within ten days); null before the first fetch. */
  usdRate: RateInForceDto | null;
  /** Phase 10: today's rate in force of each foreign currency on the draft (USD always), keyed by code. */
  fxRates?: Record<string, RateInForceDto | null>;
};

/** Phase 8: a client partner's login, as the Partners tab shows it. */
export type PartnerLoginState = 'none' | 'invited' | 'active' | 'disabled';

/** A client partner with their login state (Phase 8). The base fields are the plain `Partner`. */
export type PartnerDto = Partner & {
  loginState: PartnerLoginState;
  invitedAt: string | null;
  acceptedAt: string | null;
  notifyOnPublish: boolean;
  /** v2: the new and revised invoice emails to this partner. */
  notifyNewInvoice: boolean;
  /** v2: the roll-up of this partner's open invoices. */
  notifyRollup: boolean;
};

/** A draft invoice on the manager sheet, with the partner's promise date and the note count (Phase 8). */
export type ManagerInvoiceDto = SheetInvoice & {
  promisedOn: string | null;
  noteCount: number;
};

/** One note on an invoice. `fromSbc` marks a reply by SBC staff; otherwise the partner wrote it. */
export type InvoiceNoteDto = { id: string; invoiceId: string; authorName: string; fromSbc: boolean; text: string; createdAt: string };

export type VersionMetaDto = { id: string; seq: number; note: string; publishedAt: string; publishedByName: string };
export type VersionDto = VersionMetaDto & { snapshot: SnapshotRow[] };

export type SheetListItem = { id: string; name: string; clientOrgName: string };

export type RecipientListDto = { key: 'last' | 'partners' | 'overdue' | 'empty'; label: string; to: EmailRecipient[]; cc: EmailRecipient[]; bcc: EmailRecipient[] };

export type SummaryDto = {
  versionSeq: number;
  publishedAt: string;
  subject: string;
  html: string;
  lists: RecipientListDto[];
  contacts: EmailRecipient[];
  lastSentAt: string | null;
  /** sending | sent | failed: a failed last send shows in the dialog so the manager can retry. */
  lastSendStatus: 'sending' | 'sent' | 'failed' | null;
  /** One ready email per active client partner: only the invoices of that partner's clients. */
  partnerDrafts: PartnerDraftDto[];
  /** The leadership digest recipients, offered as "leaders"; each gets the whole-sheet email. */
  leaders: EmailRecipient[];
};

export type PartnerDraftDto = { partnerId: string; name: string; email: string; invoiceCount: number; html: string };

/** One email of a Send email batch, as the dialog sends it. */
export type SummaryEmailDto = { kind: 'partner' | 'full'; partnerId?: string; to: EmailRecipient[]; cc: EmailRecipient[]; subject: string; html: string };

export type OutlookStatusDto = { configured: boolean; connected: boolean; msEmail?: string };
