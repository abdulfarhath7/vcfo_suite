/**
 * Client portal v7 — NEW tables for the incorporation pages. Re-exported from
 * src/db/schema.ts so drizzle-kit and the repositories see one schema.
 *
 * Circular import note: this file is evaluated BEFORE schema.ts's body, so
 * `profiles` / `engagements` may only be touched lazily, inside
 * `.references(() => profiles.id)` callbacks — never at module top level.
 */
import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { engagements, profiles } from './schema';

/**
 * CLIENT FILE REQUESTS — "only files the lead asked for" (DECISIONS,
 * Incorporation › Client uploads). The firm asks the client for ONE file field
 * of ONE checklist step (e.g. the NOC from the property owner on Registered
 * Office Address). The client portal shows the drop zone for an open request,
 * the step's sticky "Approve & submit" is blocked while a request is open, and
 * the This week card lists it. The client's upload writes the step response
 * `responses[field_id] = <object path>` and fulfils the request.
 *
 * Access (Path A, `src/db/repositories/client-incorporation.ts`):
 *   admin / super_admin: all · manager: owned engagements · intern: assigned
 *   engagements — create, cancel, read · client: own engagement — read, fulfil.
 */
export const clientFileRequests = pgTable(
  'client_file_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    /** Checklist item id (`pre-14`). */
    stepId: text('step_id').notNull(),
    /** Response field id of a `file` field on that step (may be a repeat id `group.entry.field`). */
    fieldId: text('field_id').notNull(),
    /** What the client sees: "NOC from property owner". */
    label: text('label').notNull(),
    /** Optional longer line: "No-objection certificate from the owner". */
    note: text('note'),
    dueDate: date('due_date'),
    requestedBy: uuid('requested_by').references(() => profiles.id, { onDelete: 'set null' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set when the client attaches the file; cleared by the client's Undo. */
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    fulfilledBy: uuid('fulfilled_by').references(() => profiles.id, { onDelete: 'set null' }),
    /** Object path the client attached (milestone-documents key). */
    fulfilledPath: text('fulfilled_path'),
    /** Response value before the client's upload, restored by Undo. */
    previousPath: text('previous_path'),
    fileName: text('file_name'),
    sizeBytes: integer('size_bytes'),
    contentType: text('content_type'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engStepIdx: index('client_file_requests_eng_step_idx').on(t.engagementId, t.stepId),
  }),
);
