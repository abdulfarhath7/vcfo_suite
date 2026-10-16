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
