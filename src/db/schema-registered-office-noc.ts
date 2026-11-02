/**
 * Registered-office NOC (manager console, New project → NOC; owner's request,
 * prototype a59x_newproj.js). Re-exported from src/db/schema.ts so drizzle-kit
 * and the repositories see one schema.
 *
 * WHY A TABLE (migration 0029): when an incorporation project is created, the
 * manager types the property owner's details and the app generates the NOC as a
 * Word file. Those details (needed to show the NOC again and to generate it
 * again after an edit) and the signature track (generated → sent → signed, with
 * who and when) have no existing home: `documents` holds a file but no data or
 * status, and the Registered Office Address step's responses (pre-14) are the
 * client's form — a direct-flow step a manager may only read
 * (`canRoleEditField`, src/lib/pre-inc-direct-flow.ts). The Word files
 * themselves live in S3 (`generated_key`, `signed_key`).
 *
 * One row per engagement. Access (Path A, repositories/registered-office-noc.ts):
 * admin / super_admin all; manager owned + co-managed engagements (read and
 * write); project lead assigned engagements (read); client none.
 *
 * Circular import note: as in the portal schema files, `engagements` /
 * `profiles` are only touched lazily inside `.references()` callbacks.
 */
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { engagements, profiles } from './schema';

export const registeredOfficeNocs = pgTable('registered_office_nocs', {
  engagementId: uuid('engagement_id')
    .primaryKey()
    .references(() => engagements.id, { onDelete: 'cascade' }),
  /** The wizard's fields (src/lib/registered-office-noc/model.ts NocInput). */
  input: jsonb('input').notNull().default({}),
  /** generated | sent | signed */
  status: text('status').notNull().default('generated'),
  fileName: text('file_name').notNull(),
  /** S3 key of the generated Word file. */
  generatedKey: text('generated_key').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  generatedBy: uuid('generated_by').references(() => profiles.id, { onDelete: 'set null' }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  sentBy: uuid('sent_by').references(() => profiles.id, { onDelete: 'set null' }),
  /** Who it went to, as typed ("the owner", an email). */
  sentTo: text('sent_to'),
  /** S3 key of the signed copy a staff member uploaded. */
  signedKey: text('signed_key'),
  signedFileName: text('signed_file_name'),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  signedBy: uuid('signed_by').references(() => profiles.id, { onDelete: 'set null' }),
  /** [{ at, byName, text }] — the NOC's own activity, newest last. */
  history: jsonb('history').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
