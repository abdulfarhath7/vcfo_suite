/**
 * Firm-level tables added on the `ui/spectrum` branch to close the prototype gaps
 * (docs/ui-port/GAPS.md). Re-exported from src/db/schema.ts so drizzle-kit and the
 * repositories see one schema.
 *
 * Circular import note: this file is evaluated BEFORE schema.ts's body, so
 * `profiles` / `engagements` may only be touched lazily, inside
 * `.references(() => base.profiles.id)` callbacks, never at module top level.
 *
 * Tables:
 *
 *  - firm_settings       — one row (`id = 'firm'`): firm name, logo, working days,
 *                          holidays and default reminder days (G-02). Admin and super
 *                          admin write; every staff role reads.
 *  - user_sessions       — one row per signed-in device. The JWT carries the row id
 *                          (`sid`); a revoked row signs that device out (G-25).
 *  - escalations         — an engagement raised to the super admin or an admin, with
 *                          who raised it, why, and when it was resolved (G-20).
 *  - prospects           — the Growth sales pipeline (G-21). Super admin only.
 *  - saved_reports       — a report definition with an optional email schedule (G-21).
 *  - demo_requests       — the public "Book a demo" form (G-30). Insert-only from the
 *                          public route; super admin reads.
 *  - mail_groups         — named recipient groups for Email (G-23), with
 *  - mail_group_members  — one row per address in a group.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import * as base from './schema';

export const firmSettings = pgTable('firm_settings', {
  /** Always 'firm'. A text key keeps the one-row table simple to upsert. */
  id: text('id').primaryKey().default('firm'),
  firmName: text('firm_name'),
  /** S3 object key of the uploaded logo. */
  logoObjectKey: text('logo_object_key'),
  /** Working days as ISO weekday numbers, 1 = Monday to 7 = Sunday. */
  workingDays: jsonb('working_days').$type<number[]>().notNull().default([1, 2, 3, 4, 5, 6]),
  /** Firm holidays: [{ date: 'YYYY-MM-DD', label }]. */
  holidays: jsonb('holidays').$type<{ date: string; label: string }[]>().notNull().default([]),
  /** Days before a due date when the default reminders go out, for example [7, 3, 1]. */
  reminderDays: jsonb('reminder_days').$type<number[]>().notNull().default([7, 3, 1]),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  /** Reply-to and footer details for outbound client mail. */
  supportEmail: text('support_email'),
  supportPhone: text('support_phone'),
  address: text('address'),
  updatedBy: uuid('updated_by').references(() => base.profiles.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => base.profiles.id, { onDelete: 'cascade' }),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('user_sessions_user_idx').on(t.userId),
  }),
);

export const escalations = pgTable(
  'escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => base.engagements.id, { onDelete: 'cascade' }),
    raisedBy: uuid('raised_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    /** Who should act: an admin or the super admin. Null means the super admin. */
    assignedTo: uuid('assigned_to').references(() => base.profiles.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    /** open | resolved */
    status: text('status').notNull().default('open'),
    resolvedBy: uuid('resolved_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('escalations_engagement_idx').on(t.engagementId),
    statusIdx: index('escalations_status_idx').on(t.status),
  }),
);

export const prospects = pgTable(
  'prospects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    company: text('company'),
    email: text('email'),
    phone: text('phone'),
    /** referral | website | event | partner | demo_request | other */
    source: text('source').notNull().default('other'),
    /** lead | contacted | proposal | won | lost */
    stage: text('stage').notNull().default('lead'),
    /** The service asked for: incorporation | compliance | registration | other. */
    service: text('service'),
    ownerId: uuid('owner_id').references(() => base.profiles.id, { onDelete: 'set null' }),
    notes: text('notes'),
    nextStepOn: date('next_step_on'),
    /** Set when the stage becomes won or lost. */
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** The engagement created when the prospect was won, if any. */
    engagementId: uuid('engagement_id').references(() => base.engagements.id, {
      onDelete: 'set null',
    }),
    createdBy: uuid('created_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    stageIdx: index('prospects_stage_idx').on(t.stage),
  }),
);

export const savedReports = pgTable('saved_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => base.profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** The report kind, for example portfolio | filings | risks | team | growth. */
  kind: text('kind').notNull(),
  /** Filters for the report (date range, practice area, manager). */
  params: jsonb('params').$type<Record<string, unknown>>().notNull().default({}),
  /** none | weekly | monthly */
  schedule: text('schedule').notNull().default('none'),
  recipients: text('recipients').array().notNull().default([]),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const demoRequests = pgTable('demo_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  company: text('company'),
  phone: text('phone'),
  message: text('message'),
  /** Set when a super admin turns the request into a prospect. */
  prospectId: uuid('prospect_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mailGroups = pgTable('mail_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** A firm-wide group every staff member can use; otherwise only the owner sees it. */
  shared: boolean('shared').notNull().default(false),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => base.profiles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mailGroupMembers = pgTable(
  'mail_group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => mailGroups.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name'),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    groupEmailUq: uniqueIndex('mail_group_members_group_email_uq').on(t.groupId, t.email),
  }),
);
