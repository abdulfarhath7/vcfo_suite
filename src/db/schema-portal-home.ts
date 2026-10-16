/**
 * Client portal v7 — NEW tables for the home pages. Re-exported from
 * src/db/schema.ts so drizzle-kit and the repositories see one schema.
 *
 * Circular import note: this file is evaluated BEFORE schema.ts's body, so
 * `profiles` / `engagements` may only be touched lazily, inside
 * `.references(() => profiles.id)` callbacks — never at module top level.
 *
 * Tables (all read/written ONLY through src/db/repositories/client-home.ts and
 * src/db/repositories/client-change-requests.ts):
 *
 *  - client_need_meta          — what a document request is FOR: the step or
 *                                filing it belongs to, the verb the client sees
 *                                (upload / fill / correct / sign) and a due date.
 *                                One row per `document_requests` row (optional).
 *  - client_work_items         — "What SBC is doing": firm work the client may
 *                                see, with a % done and a ready date.
 *  - client_timeline_requests  — a client's timeline change request (Home ›
 *                                Timeline › Edit). The manager approves or
 *                                rejects it; nothing changes on the schedule
 *                                until then.
 */
import { date, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import * as base from './schema';

export const clientNeedMeta = pgTable(
  'client_need_meta',
  {
    requestId: uuid('request_id')
      .primaryKey()
      .references(() => base.documentRequests.id, { onDelete: 'cascade' }),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => base.engagements.id, { onDelete: 'cascade' }),
    /** Checklist step the item belongs to (e.g. 'pre-14'). */
    stepId: text('step_id'),
    /** compliance_instances.id when the item feeds a filing. */
    complianceInstanceId: uuid('compliance_instance_id'),
    /** upload | fill | correct | sign */
    kind: text('kind').notNull().default('upload'),
    dueDate: date('due_date'),
    /** Optional checklist response field the upload fills. */
    fieldId: text('field_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('client_need_meta_engagement_idx').on(t.engagementId),
  }),
);

export const clientWorkItems = pgTable(
  'client_work_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => base.engagements.id, { onDelete: 'cascade' }),
    stepId: text('step_id'),
    title: text('title').notNull(),
    assigneeId: uuid('assignee_id').references(() => base.profiles.id, { onDelete: 'set null' }),
    /** 0–100 */
    progressPct: integer('progress_pct').notNull().default(0),
    readyOn: date('ready_on'),
    /** active | done | hidden */
    status: text('status').notNull().default('active'),
    createdBy: uuid('created_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('client_work_items_engagement_idx').on(t.engagementId),
  }),
);

export const clientTimelineRequests = pgTable(
  'client_timeline_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => base.engagements.id, { onDelete: 'cascade' }),
    /** The task the request created in the lead's queue. */
    taskId: uuid('task_id').references(() => base.tasks.id, { onDelete: 'set null' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => base.profiles.id, { onDelete: 'cascade' }),
    requestedByName: text('requested_by_name'),
    reason: text('reason').notNull(),
    /** { phases: [{ id, name, from, to }], coiFrom, coiTo, slipDays } */
    payload: jsonb('payload').notNull().default({}),
    /** pending | approved | rejected | withdrawn */
    status: text('status').notNull().default('pending'),
    decidedBy: uuid('decided_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('client_timeline_requests_engagement_idx').on(t.engagementId),
  }),
);
