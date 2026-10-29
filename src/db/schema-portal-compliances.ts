/**
 * Client portal v7 — NEW tables for the compliances pages. Re-exported from
 * src/db/schema.ts so drizzle-kit and the repositories see one schema.
 *
 * Circular import note: this file is evaluated BEFORE schema.ts's body, so
 * `profiles` / `engagements` / `complianceInstances` may only be touched
 * lazily, inside `.references(() => …)` callbacks — never at module top level.
 *
 * Tables (all keyed by `compliance_instances.id`, so the Inngest regeneration
 * upsert of `compliance_instances` never has to know about them):
 *  - `compliance_instance_proofs`  — rule 15 📎 proof files (many per filing), S3.
 *  - `compliance_instance_details` — side table for the facts the filing detail
 *    shows that the register has no column for: ARN / SRN / challan no., tax
 *    paid, filed by, and the dates behind the focus track (data received,
 *    preparing since, draft due, approval due / approved).
 *  - `compliance_reminders`       — per-user "Remind me" on one filing.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { complianceInstances, engagements, profiles } from './schema';

export const complianceInstanceProofs = pgTable(
  'compliance_instance_proofs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => complianceInstances.id, { onDelete: 'cascade' }),
    /** Denormalised for scoping (Path A) without a join. */
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    /** Path inside the `engagement-documents` bucket prefix (see src/storage/s3.ts bucketKey). */
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mime: text('mime'),
    sizeBytes: integer('size_bytes'),
    /** acknowledgement | challan | certificate | other */
    kind: text('kind').notNull().default('acknowledgement'),
    /** The highlighted (primary) proof in the side panel. */
    isPrimary: boolean('is_primary').notNull().default(false),
    uploadedBy: uuid('uploaded_by').references(() => profiles.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    instanceIdx: index('compliance_instance_proofs_instance_idx').on(t.instanceId),
    engagementIdx: index('compliance_instance_proofs_engagement_idx').on(t.engagementId),
  }),
);

export const complianceInstanceDetails = pgTable('compliance_instance_details', {
  instanceId: uuid('instance_id')
    .primaryKey()
    .references(() => complianceInstances.id, { onDelete: 'cascade' }),
  /** ARN / SRN / challan CIN / token number shown as "ARN". */
  acknowledgementNo: text('acknowledgement_no'),
  /** INR, cash + ITC as filed. */
  amountPaid: numeric('amount_paid', { precision: 14, scale: 2 }),
  filedBy: uuid('filed_by').references(() => profiles.id, { onDelete: 'set null' }),
  dataReceivedOn: date('data_received_on'),
  preparingSince: date('preparing_since'),
  draftDueOn: date('draft_due_on'),
  approvalDueOn: date('approval_due_on'),
  approvedOn: date('approved_on'),
  updatedBy: uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const complianceReminders = pgTable(
  'compliance_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => complianceInstances.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    /** The day the nudge goes out (due − 3 days, or today when closer). */
    remindOn: date('remind_on').notNull(),
    /** ['email'] or ['email','whatsapp'] — WhatsApp is an additive nudge only. */
    channels: jsonb('channels').notNull().default(['email']),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    oneEach: uniqueIndex('compliance_reminders_instance_user_idx').on(t.instanceId, t.userId),
    dueIdx: index('compliance_reminders_remind_on_idx').on(t.remindOn),
  }),
);

/**
 * COMPLIANCE SUBJECT FIELDS (0029, C-415, C-417, C-492, S-774, S-811): the values of the
 * fields on an obligation period or a registration. The field list is static data
 * (`src/data/compliance-inputs.ts`); a row holds one value. side 'client' is the "From the
 * client" details the client submits; side 'sbc' is the "Filled by SBC" card.
 */
export const complianceSubjectFields = pgTable(
  'compliance_subject_fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The engagement the subject belongs to; every read and write is scoped by it. */
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    /** 'obligation' (keyed by compliance instance id) or 'registration' (keyed by step id). */
    subjectKind: text('subject_kind').notNull(),
    /** The compliance instance id or the registration step id ('reg-4'). */
    subjectKey: text('subject_key').notNull(),
    /** The field key from the static field list ('turnover', 'gstin'). */
    fieldKey: text('field_key').notNull(),
    /** 'client' (the client fills it) or 'sbc' (SBC fills it). */
    side: text('side').notNull(),
    /** The value as typed; empty values are stored as null. */
    value: text('value'),
    /** Who last saved the value. */
    updatedBy: uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
    /** When the value was last saved. */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** When the client pressed "Submit details" for this value; null for SBC fields. */
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    /** The staff member who confirmed the client's value ("Confirmed by"). */
    confirmedBy: uuid('confirmed_by').references(() => profiles.id, { onDelete: 'set null' }),
    /** When the client's value was confirmed; cleared when the client changes it. */
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => ({
    oneEach: uniqueIndex('compliance_subject_fields_uq').on(t.engagementId, t.subjectKind, t.subjectKey, t.fieldKey),
  }),
);

/**
 * ASSIST RUNS (0029, C-324, C-363, C-377, S-773, S-809): one VCFO Assist run on a government
 * portal for one filing period or one registration. Staff "Start filing" creates a requested
 * run; the VCFO Assist extension posts its progress and result to
 * `/api/assist/engagements/[id]/runs` from inside a signed-in Suite tab.
 */
export const assistRuns = pgTable(
  'assist_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The engagement the run belongs to; every read and write is scoped by it. */
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    /** 'filing' (keyed by compliance instance id) or 'registration' (keyed by step id). */
    subjectKind: text('subject_kind').notNull(),
    /** The compliance instance id or the registration step id ('reg-4'). */
    subjectKey: text('subject_key').notNull(),
    /** The portal form the run fills ('GSTR-3B', 'SPICe+ Part A', 'GST REG-01'). */
    form: text('form'),
    /** requested | running | paused | done | failed | stopped */
    state: text('state').notNull().default('requested'),
    /** The steps as the extension reports them: [{ title, state: done|run|wait, at?, shotKey? }]. */
    steps: jsonb('steps').notNull().default([]),
    /** The reference the portal gave back (SRN, ARN), when the run reached it. */
    reference: text('reference'),
    /** How many portal fields the extension wrote. */
    fieldsWritten: integer('fields_written'),
    /** Values the portal showed that differ from VCFO: [{ field, expected, actual }]. */
    mismatches: jsonb('mismatches').notNull().default([]),
    /** The extension's error or halt reason when the run stopped. */
    error: text('error'),
    /** The Idempotency-Key the extension sent, so a repeat post updates the same run. */
    idempotencyKey: text('idempotency_key'),
    /** The recipe and field-map versions the extension ran with ("recipe 3 · map 5"). */
    versions: text('versions'),
    /** Who pressed "Start filing", or whose Suite session posted the first update. */
    startedBy: uuid('started_by').references(() => profiles.id, { onDelete: 'set null' }),
    /** When the run was requested or first reported. */
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** When the last update arrived. */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** When the run reached done, failed or stopped. */
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => ({
    subjectIdx: index('assist_runs_subject_idx').on(t.engagementId, t.subjectKind, t.subjectKey, t.startedAt),
    idemIdx: uniqueIndex('assist_runs_idempotency_idx').on(t.engagementId, t.idempotencyKey),
  }),
);
