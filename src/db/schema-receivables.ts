/**
 * Receivables (3 Nov 2026, docs/specs/receivables/PLAN.md).
 * Re-exported from src/db/schema.ts so drizzle-kit and the repositories see one schema.
 * Additive only: new tables, no change to existing ones.
 *
 * Circular import note: this file is evaluated BEFORE schema.ts's body, so `profiles` may only be
 * touched lazily, inside `.references(() => base.profiles.id)` callbacks.
 *
 * Tables:
 *  - receivable_sheets        — one client organisation's sheet: its manager, the public link key,
 *                               the published version and the reminder rules.
 *  - receivable_sheet_editors — extra staff (a project lead, a second manager) who may edit a sheet.
 *  - receivable_partners      — the client partners (filter on the public page, reminder recipients).
 *  - receivable_invoices      — the live draft: one row per invoice.
 *  - receivable_versions      — what Update published; the public page reads only these snapshots.
 *  - receivable_changes       — one row per edit, the audit trail and the "unpublished" count.
 *  - receivable_reminders     — one row per invoice per day; the unique key stops double sends.
 *  - (bank_credits, the HSBC bank feed, was dropped in receivables v2.)
 *  - receivable_email_sends   — each summary email the manager sent.
 *
 * Receivables v2 (docs/specs/receivables/V2.md):
 *  - receivable_clients             — the sheet's clients, each with at most one client partner.
 *  - receivable_digest_recipients   — typed-in leadership addresses for the weekly digest.
 *  - receivable_import_batches      — one Tally Sales Register upload.
 *  - receivable_import_rows         — rows waiting for approval (from Tally or a staff amount change).
 *  - receivable_email_log           — every automatic or manual v2 email and its WhatsApp ping.
 */
import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import * as base from './schema';
import type { ReminderRules, SnapshotRow, EmailRecipient } from '@/lib/receivables/model';
import type { ShareFilters } from '@/lib/receivables/share-filters';

export const receivableSheets = pgTable(
  'receivable_sheets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    clientOrgName: text('client_org_name').notNull(),
    /** The one staff member who edits and publishes this sheet. Firm-wide admins may also. */
    managerUserId: uuid('manager_user_id').references(() => base.profiles.id, { onDelete: 'set null' }),
    /** The secret part of the public link, /receivables/k/<public_key>. Reset to revoke old links. */
    publicKey: text('public_key').notNull(),
    /** true: the plain /receivables URL shows nothing and only the key link works. */
    requireKey: boolean('require_key').notNull().default(true),
    /** The version the public page shows. No foreign key, to keep the two tables acyclic. */
    publishedVersionId: uuid('published_version_id'),
    reminderRules: jsonb('reminder_rules').$type<ReminderRules>().notNull(),
    /*
     * Receivables v2 (docs/specs/receivables/V2.md): the automatic emails. Every switch is off on
     * a new sheet, so nothing is sent until someone on the People tab turns it on.
     */
    /** The weekly leadership digest's master switch. */
    digestEnabled: boolean('digest_enabled').notNull().default(false),
    /** 0 = Sunday … 6 = Saturday, the day the leadership digest goes out. */
    digestWeekday: integer('digest_weekday').notNull().default(1),
    /** The IST hour the leadership digest goes out. */
    digestHourIst: integer('digest_hour_ist').notNull().default(9),
    /** The client partner roll-up goes out every this many days. Unused since 17 Nov 2026 (rollup_weekdays). */
    rollupEveryDays: integer('rollup_every_days').notNull().default(3),
    /** The weekdays the roll-up goes out on (0 = Sunday … 6 = Saturday), picked on the People tab. */
    rollupWeekdays: integer('rollup_weekdays').array().notNull().default(sql`'{1,4}'::integer[]`),
    /** The IST hour the roll-up goes out. */
    sendHourIst: integer('send_hour_ist').notNull().default(9),
    emailNewInvoiceEnabled: boolean('email_new_invoice_enabled').notNull().default(false),
    emailRollupEnabled: boolean('email_rollup_enabled').notNull().default(false),
    emailRevisedEnabled: boolean('email_revised_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyIdx: uniqueIndex('receivable_sheets_public_key_idx').on(t.publicKey),
    managerIdx: index('receivable_sheets_manager_idx').on(t.managerUserId),
  }),
);

/**
 * Extra staff who may read and edit one sheet, besides its manager and the firm-wide admins.
 * The manager stays the one person reminders and the Monday digest are sent as and to.
 */
export const receivableSheetEditors = pgTable(
  'receivable_sheet_editors',
  {
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => base.profiles.id, { onDelete: 'cascade' }),
    addedBy: uuid('added_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sheetId, t.userId] }),
    userIdx: index('receivable_sheet_editors_user_idx').on(t.userId),
  }),
);

export const receivablePartners = pgTable(
  'receivable_partners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    /** Short id used in ?partner=<slug> links. */
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    active: boolean('active').notNull().default(true),
    /**
     * Phase 8: the partner's own login (a `partner` profile), set when the manager invites them.
     * Null until invited. Disabling the login clears nothing here; the profile is deactivated.
     */
    profileId: uuid('profile_id').references(() => base.profiles.id, { onDelete: 'set null' }),
    /** Email the partner when the manager publishes an Update that changes their invoices. */
    notifyOnPublish: boolean('notify_on_publish').notNull().default(true),
    /** v2: the new and revised invoice emails to this partner (the sheet switch must be on too). */
    notifyNewInvoice: boolean('notify_new_invoice').notNull().default(true),
    /** v2: the roll-up of this partner's open invoices (the sheet switch must be on too). */
    notifyRollup: boolean('notify_rollup').notNull().default(true),
    /** The stored hash of the set-password link token (the raw token only travels in the email). */
    setPasswordTokenHash: text('set_password_token_hash'),
    setPasswordExpiresAt: timestamp('set_password_expires_at', { withTimezone: true }),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    inviteSendCount: integer('invite_send_count').notNull().default(0),
    /** When the partner first set their password. */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('receivable_partners_sheet_slug_idx').on(t.sheetId, t.slug),
    profileIdx: index('receivable_partners_profile_idx').on(t.profileId),
    tokenIdx: index('receivable_partners_token_idx').on(t.setPasswordTokenHash),
  }),
);

export const receivableInvoices = pgTable(
  'receivable_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    /** First day of the invoice month, e.g. 2026-09-01 for the "September-26" block. */
    invoiceMonth: date('invoice_month').notNull(),
    clientName: text('client_name').notNull(),
    /** Optional: the sheet today often has no invoice number. */
    invoiceNo: text('invoice_no'),
    partnerId: uuid('partner_id').references(() => receivablePartners.id, { onDelete: 'set null' }),
    dueDate: date('due_date').notNull(),
    /** The open balance in INR. A part payment lowers it and adds to part_paid. */
    amountInr: numeric('amount_inr', { precision: 14, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('INR'),
    fcAmount: numeric('fc_amount', { precision: 14, scale: 2 }),
    fxRate: numeric('fx_rate', { precision: 12, scale: 6 }),
    /** open | received. */
    status: text('status').notNull().default('open'),
    paidOn: date('paid_on'),
    paidAmount: numeric('paid_amount', { precision: 14, scale: 2 }),
    /** manual | bank. */
    paidVia: text('paid_via'),
    partPaid: numeric('part_paid', { precision: 14, scale: 2 }).notNull().default('0'),
    remindersPausedUntil: date('reminders_paused_until'),
    pauseReason: text('pause_reason'),
    /** Phase 8: the date the client partner says the client promised to pay. Live, not published. */
    promisedOn: date('promised_on'),
    promisedBy: uuid('promised_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    promisedAt: timestamp('promised_at', { withTimezone: true }),
    /** Phase 9: the invoice date (the FX booking date for a foreign invoice). Null on imported rows. */
    invoiceDate: date('invoice_date'),
    /** Phase 9: the foreign amount that actually arrived (paid_amount holds the INR credited). */
    receivedFc: numeric('received_fc', { precision: 14, scale: 2 }),
    /** Phase 9: TDS the client deducted, in INR. The certificate (Form 16A) is tracked by tds_certificate_on. */
    tdsInr: numeric('tds_inr', { precision: 14, scale: 2 }).notNull().default('0'),
    tdsCertificateOn: date('tds_certificate_on'),
    /** Phase 9: a dispute stops reminders and leaves the invoice out of the ageing until resolved. */
    disputedAt: timestamp('disputed_at', { withTimezone: true }),
    disputeReason: text('dispute_reason'),
    disputeResolvedAt: timestamp('dispute_resolved_at', { withTimezone: true }),
    /** v2: the client record this invoice belongs to. Null on rows made before v2 until backfilled. */
    clientId: uuid('client_id').references((): AnyPgColumn => receivableClients.id, { onDelete: 'set null' }),
    gstin: text('gstin'),
    /** v2: how many approved amount changes this invoice has had (shown as r1, r2 …). */
    revision: integer('revision').notNull().default(0),
    /** v2: a staff amount change the Tally books do not show yet; a matching Tally upload clears it. */
    tallyMismatch: boolean('tally_mismatch').notNull().default(false),
    /** v2: manual | tally. */
    source: text('source').notNull().default('manual'),
    createdBy: uuid('created_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    clientIdx: index('receivable_invoices_client_idx').on(t.clientId),
    sheetStatusIdx: index('receivable_invoices_sheet_status_idx').on(t.sheetId, t.status),
    sheetDueIdx: index('receivable_invoices_sheet_due_idx').on(t.sheetId, t.dueDate),
    partnerIdx: index('receivable_invoices_partner_idx').on(t.partnerId),
  }),
);

export const receivableVersions = pgTable(
  'receivable_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    /** 1, 2, 3 … per sheet. */
    seq: integer('seq').notNull(),
    note: text('note').notNull().default(''),
    /** The invoices exactly as published, partner names included. */
    snapshot: jsonb('snapshot').$type<SnapshotRow[]>().notNull(),
    publishedBy: uuid('published_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    publishedByName: text('published_by_name').notNull().default(''),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    seqIdx: uniqueIndex('receivable_versions_sheet_seq_idx').on(t.sheetId, t.seq),
  }),
);

export const receivableChanges = pgTable(
  'receivable_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').references(() => receivableInvoices.id, { onDelete: 'set null' }),
    actorId: uuid('actor_id').references(() => base.profiles.id, { onDelete: 'set null' }),
    /** A short plain sentence, e.g. "Duravant SC/09/03 marked received". */
    summary: text('summary').notNull(),
    field: text('field'),
    before: text('before'),
    after: text('after'),
    /** false for changes the public page never shows (a reminder pause), so they need no Update. */
    affectsPage: boolean('affects_page').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sheetIdx: index('receivable_changes_sheet_idx').on(t.sheetId, t.createdAt),
  }),
);

export const receivableReminders = pgTable(
  'receivable_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => receivableInvoices.id, { onDelete: 'cascade' }),
    partnerId: uuid('partner_id').references(() => receivablePartners.id, { onDelete: 'set null' }),
    /** The IST day the reminder is for. */
    forDate: date('for_date').notNull(),
    /** before | due | overdue. Receivables v2 removed the reminders; the table is kept, unused, and can be dropped later. */
    kind: text('kind').notNull(),
    /** Days before the due date (positive) or after it (negative), on for_date. */
    daysLeft: integer('days_left').notNull(),
    /** queued | skipped | sent | failed. */
    status: text('status').notNull().default('queued'),
    subjectOverride: text('subject_override'),
    bodyOverride: text('body_override'),
    toEmail: text('to_email'),
    /** outlook | email (the SES/Resend fallback). */
    channel: text('channel'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    onePerDayIdx: uniqueIndex('receivable_reminders_invoice_day_idx').on(t.invoiceId, t.forDate),
    sheetDayIdx: index('receivable_reminders_sheet_day_idx').on(t.sheetId, t.forDate),
  }),
);

/*
 * bank_credits (the HSBC feed) was dropped in receivables v2 by migration 0059_drop_bank_credits.
 */

export const receivableEmailSends = pgTable(
  'receivable_email_sends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id').references(() => receivableVersions.id, { onDelete: 'set null' }),
    toList: jsonb('to_list').$type<EmailRecipient[]>().notNull().default([]),
    ccList: jsonb('cc_list').$type<EmailRecipient[]>().notNull().default([]),
    bccList: jsonb('bcc_list').$type<EmailRecipient[]>().notNull().default([]),
    subject: text('subject').notNull(),
    /** outlook | email. */
    channel: text('channel').notNull(),
    /** sending | sent | failed. The send finishes after the response, so the row is written first. */
    status: text('status').notNull().default('sent'),
    /** Why a failed send failed, in a few words for the manager. */
    error: text('error'),
    sentBy: uuid('sent_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sheetIdx: index('receivable_email_sends_sheet_idx').on(t.sheetId, t.sentAt),
  }),
);

/**
 * Phase 8: notes on one invoice, written by the client partner or by SBC. Live (never part of a
 * published snapshot), so a note needs no Update. A partner sees only the notes on their own
 * invoices; `from_sbc` marks the manager's replies.
 */
export const receivableInvoiceNotes = pgTable(
  'receivable_invoice_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => receivableInvoices.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => base.profiles.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull().default(''),
    fromSbc: boolean('from_sbc').notNull().default(false),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    invoiceIdx: index('receivable_invoice_notes_invoice_idx').on(t.invoiceId, t.createdAt),
  }),
);

/**
 * Phase 9: daily reference rates, INR per one unit of `currency`. The 14:30 IST job stores the
 * fetched rate (source `fbil`, or `ecb` when only the Frankfurter fallback answered); a manager
 * override is a second row with source `manual`, which wins for that day.
 */
export const fxRates = pgTable(
  'fx_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    currency: text('currency').notNull(),
    rateDate: date('rate_date').notNull(),
    rate: numeric('rate', { precision: 12, scale: 6 }).notNull(),
    /** fbil | ecb | manual. */
    source: text('source').notNull(),
    note: text('note').notNull().default(''),
    setBy: uuid('set_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dayIdx: uniqueIndex('fx_rates_currency_day_source_idx').on(t.currency, t.rateDate, t.source),
  }),
);

/** Phase 9: a credit note against one invoice. It lowers the open balance when the manager applies it. */
export const receivableCreditNotes = pgTable(
  'receivable_credit_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => receivableInvoices.id, { onDelete: 'cascade' }),
    number: text('number'),
    issuedOn: date('issued_on').notNull(),
    amountInr: numeric('amount_inr', { precision: 14, scale: 2 }).notNull(),
    reason: text('reason').notNull().default(''),
    createdBy: uuid('created_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    invoiceIdx: index('receivable_credit_notes_invoice_idx').on(t.invoiceId),
  }),
);

/**
 * Phase 9: Foreign Inward Remittance Advices. Every foreign receipt needs one from the bank for
 * the export (GST/FEMA) file; a row is `awaited` from the day the money lands until the advice arrives.
 */
export const receivableFiras = pgTable(
  'receivable_firas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').references(() => receivableInvoices.id, { onDelete: 'set null' }),
    /** The bank credit it came from, while the HSBC feed existed; plain history since v2 dropped bank_credits. */
    bankCreditId: uuid('bank_credit_id'),
    /** awaited | received. */
    status: text('status').notNull().default('awaited'),
    firaNo: text('fira_no'),
    issuedOn: date('issued_on'),
    currency: text('currency').notNull().default('USD'),
    fcAmount: numeric('fc_amount', { precision: 14, scale: 2 }),
    inrAmount: numeric('inr_amount', { precision: 14, scale: 2 }),
    note: text('note').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sheetIdx: index('receivable_firas_sheet_status_idx').on(t.sheetId, t.status),
    invoiceIdx: index('receivable_firas_invoice_idx').on(t.invoiceId),
  }),
);

/**
 * Phase 10: a saved, filtered view of the published sheet behind its own link
 * (`/receivables/s/<token>`). `public` opens for anyone with the link; `login` needs any
 * client-partner login on this sheet (or the sheet's staff); `restricted` needs one of the
 * `allowed_emails` logins. The sheet's manager and the firm-wide admins can always open it.
 * The view always shows the latest published version, never a draft.
 */
export const receivableShareLinks = pgTable(
  'receivable_share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    /** The random, URL-safe part of the link. */
    token: text('token').notNull(),
    name: text('name').notNull(),
    filters: jsonb('filters').$type<ShareFilters>().notNull(),
    /** public | login | restricted. */
    visibility: text('visibility').notNull(),
    /** Lower-cased emails allowed when visibility is `restricted`. */
    allowedEmails: jsonb('allowed_emails').$type<string[]>().notNull().default([]),
    /** Whether the Excel download is offered on the shared view. */
    allowDownload: boolean('allow_download').notNull().default(true),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex('receivable_share_links_token_idx').on(t.token),
    sheetIdx: index('receivable_share_links_sheet_idx').on(t.sheetId),
  }),
);

/** Phase 10: one row per opening of a share link, so the manager sees who looked and when. */
export const receivableShareViews = pgTable(
  'receivable_share_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    linkId: uuid('link_id')
      .notNull()
      .references(() => receivableShareLinks.id, { onDelete: 'cascade' }),
    /** Null for an anonymous view of a public link. */
    viewerId: uuid('viewer_id').references(() => base.profiles.id, { onDelete: 'set null' }),
    viewerEmail: text('viewer_email'),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    linkIdx: index('receivable_share_views_link_idx').on(t.linkId, t.viewedAt),
  }),
);

/**
 * Phase 10: forward contracts booked with the bank to fix the rupee value of future foreign
 * receipts. `utilised_fc` grows as receipts are settled against the contract.
 */
export const receivableFxForwards = pgTable(
  'receivable_fx_forwards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    currency: text('currency').notNull().default('USD'),
    bank: text('bank').notNull().default(''),
    contractNo: text('contract_no'),
    amountFc: numeric('amount_fc', { precision: 14, scale: 2 }).notNull(),
    forwardRate: numeric('forward_rate', { precision: 12, scale: 6 }).notNull(),
    bookedOn: date('booked_on').notNull(),
    maturityOn: date('maturity_on').notNull(),
    utilisedFc: numeric('utilised_fc', { precision: 14, scale: 2 }).notNull().default('0'),
    /** open | closed | cancelled. */
    status: text('status').notNull().default('open'),
    note: text('note').notNull().default(''),
    createdBy: uuid('created_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sheetIdx: index('receivable_fx_forwards_sheet_idx').on(t.sheetId, t.status),
  }),
);

/** Phase 10: tell the manager when a currency's reference rate crosses a level. */
export const receivableFxAlerts = pgTable(
  'receivable_fx_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    currency: text('currency').notNull().default('USD'),
    /** above | below. */
    direction: text('direction').notNull(),
    threshold: numeric('threshold', { precision: 12, scale: 6 }).notNull(),
    active: boolean('active').notNull().default(true),
    lastTriggeredOn: date('last_triggered_on'),
    createdBy: uuid('created_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sheetIdx: index('receivable_fx_alerts_sheet_idx').on(t.sheetId, t.active),
  }),
);

/**
 * Receivables v2: the sheet's clients. A client has at most one client partner; a partner has many
 * clients. `client_key` is the name in lower case with punctuation and spaces collapsed
 * (src/lib/receivables/client-key.ts), so "Machinify, Inc" and "Machinify Inc" are one client.
 */
export const receivableClients = pgTable(
  'receivable_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    clientKey: text('client_key').notNull(),
    gstin: text('gstin'),
    /** Due date = invoice date + credit days. */
    creditDays: integer('credit_days').notNull().default(7),
    billingEmail: text('billing_email'),
    billingCc: text('billing_cc').array().notNull().default([]),
    partnerId: uuid('partner_id').references(() => receivablePartners.id, { onDelete: 'set null' }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyIdx: uniqueIndex('receivable_clients_sheet_key_idx').on(t.sheetId, t.clientKey),
    partnerIdx: index('receivable_clients_partner_idx').on(t.partnerId),
  }),
);

/** Receivables v2: the leadership digest's recipients. Typed-in names and addresses, not tool accounts. */
export const receivableDigestRecipients = pgTable(
  'receivable_digest_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sheetIdx: index('receivable_digest_recipients_sheet_idx').on(t.sheetId),
  }),
);

/** Receivables v2: one Tally Sales Register upload. A sheet has at most one pending batch. */
export const receivableImportBatches = pgTable(
  'receivable_import_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    /** The company name and the period from the register's header block. */
    company: text('company').notNull().default(''),
    period: text('period').notNull().default(''),
    uploadedBy: uuid('uploaded_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    /** pending | approved | discarded. */
    status: text('status').notNull().default('pending'),
    rowCount: integer('row_count').notNull().default(0),
    newCount: integer('new_count').notNull().default(0),
    changedCount: integer('changed_count').notNull().default(0),
    sameCount: integer('same_count').notNull().default(0),
    noPartnerCount: integer('no_partner_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sheetIdx: index('receivable_import_batches_sheet_idx').on(t.sheetId, t.status),
  }),
);

/**
 * Receivables v2: one row waiting for approval. Tally rows belong to a batch; a staff amount change
 * has no batch. Approving a `new` row makes an invoice; approving a `changed` row sets the amount.
 */
export const receivableImportRows = pgTable(
  'receivable_import_rows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id').references(() => receivableImportBatches.id, { onDelete: 'cascade' }),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    /** new | changed | same | no_partner. */
    kind: text('kind').notNull(),
    /** The invoice a `changed` or `same` row matched. */
    invoiceId: uuid('invoice_id').references(() => receivableInvoices.id, { onDelete: 'cascade' }),
    /** Exactly as Tally wrote it. */
    invoiceNo: text('invoice_no'),
    /** The normalised voucher key (leading zeros dropped in each number). */
    invoiceKey: text('invoice_key'),
    invoiceDate: date('invoice_date'),
    clientName: text('client_name').notNull(),
    clientId: uuid('client_id').references(() => receivableClients.id, { onDelete: 'set null' }),
    partnerId: uuid('partner_id').references(() => receivablePartners.id, { onDelete: 'set null' }),
    gstin: text('gstin'),
    amountInr: numeric('amount_inr', { precision: 14, scale: 2 }).notNull(),
    oldAmountInr: numeric('old_amount_inr', { precision: 14, scale: 2 }),
    dueDate: date('due_date'),
    /** Why the amount changed (required on a staff change). */
    reason: text('reason'),
    /** tally | staff. */
    source: text('source').notNull(),
    requestedBy: uuid('requested_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    /** pending | approved | rejected | skipped. */
    status: text('status').notNull().default('pending'),
    decidedBy: uuid('decided_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sheetIdx: index('receivable_import_rows_sheet_idx').on(t.sheetId, t.status),
    batchIdx: index('receivable_import_rows_batch_idx').on(t.batchId),
  }),
);

/**
 * Receivables v2: one row per v2 email (new invoice, revised, roll-up, digest, client statement),
 * written as `sending` before the send and finished as `sent`, `failed` or `skipped`. The HTML is
 * kept so Retry sends the same message. `dedupe_key` keeps each automatic send to once per period
 * (for example `rollup:<partner id>:<date>`); manual sends leave it null.
 */
export const receivableEmailLog = pgTable(
  'receivable_email_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => receivableSheets.id, { onDelete: 'cascade' }),
    /** new_invoice | revised | rollup | digest | client_statement. */
    kind: text('kind').notNull(),
    partnerId: uuid('partner_id').references(() => receivablePartners.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => receivableClients.id, { onDelete: 'set null' }),
    /** The period the automatic send covers (a date or an ISO week); null for manual sends. */
    periodKey: text('period_key'),
    dedupeKey: text('dedupe_key'),
    recipientName: text('recipient_name').notNull().default(''),
    to: text('to').array().notNull().default([]),
    cc: text('cc').array().notNull().default([]),
    subject: text('subject').notNull(),
    html: text('html').notNull().default(''),
    text: text('text').notNull().default(''),
    /** Whose Outlook it went from. */
    senderUserId: uuid('sender_user_id').references(() => base.profiles.id, { onDelete: 'set null' }),
    invoiceIds: jsonb('invoice_ids').$type<string[]>().notNull().default([]),
    /** What the WhatsApp ping says the email was about ("SCSPL/26-27/164", "Machinify Inc"). */
    about: text('about').notNull().default(''),
    /** sending | sent | failed | skipped. */
    status: text('status').notNull().default('sending'),
    error: text('error'),
    /** The sent email's Outlook on the web link (opens only in the sender's mailbox), for the WhatsApp ping. */
    webLink: text('web_link'),
    /** The WhatsApp ping to the sender: sent | failed | no_phone | disabled; null until tried. */
    whatsappStatus: text('whatsapp_status'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sheetIdx: index('receivable_email_log_sheet_idx').on(t.sheetId, t.createdAt),
    dedupeIdx: uniqueIndex('receivable_email_log_dedupe_idx').on(t.dedupeKey),
  }),
);
