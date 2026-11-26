import { date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import * as base from './schema';

/**
 * CARD AGENTS (docs/specs/live-portal-browser/MASTER-PLAN.md). Six tables, all additive
 * (migration 0073):
 *
 * - `agent_settings`: firm-wide switches the admin sets on Settings > Agents (kill switch, route
 *   switches, pilot users, browser-hour cap). One row per key; the value is JSON.
 * - `live_browser_sessions`: one row per live portal session on SBC's server browser. It holds
 *   the state and the evidence (who, when, which IP). It never holds a cookie, a token, a
 *   password, a captcha or an OTP (SAFETY.md G8, proposed G19).
 * - `gstn_sessions`: whether a GSTIN has an active GSTN API session at the GSP (GSTZen). Status and
 *   expiry only; the GSP holds the GSTN tokens.
 * - `gst_return_runs`: one GST return filed through the GSP API (GSTR-1, GSTR-3B, GSTR-9, GSTR-9C).
 * - `agent_otp_requests`: a "Your turn: type the OTP" request shown to a staff member or the client.
 *   The OTP itself is sent straight to the GSP or the portal and is never stored.
 * - `gst_notices`: GST notices read through the GSP notice API.
 */

export const agentSettings = pgTable('agent_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedBy: uuid('updated_by').references(() => base.profiles.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export interface LiveBrowserViewer {
  userId: string;
  ip: string | null;
  firstAt: string;
  lastAt: string;
}

export const liveBrowserSessions = pgTable(
  'live_browser_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => base.engagements.id, { onDelete: 'cascade' }),
    /** Catalog task id, for example `spice-a`. */
    taskId: text('task_id').notNull(),
    /** The assist run the session drives, once the engine has created it. */
    runId: uuid('run_id'),
    startedBy: uuid('started_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    startedByName: text('started_by_name'),
    /** The portal host the session opened (a mock host until the pack is live). */
    portalHost: text('portal_host'),
    /** The portal login the person said they use (a label, never a password); one open run per label (G21). */
    portalLoginLabel: text('portal_login_label'),
    /** starting | ready | your_turn | running | paused | done | cancelled | failed | expired */
    status: text('status').notNull().default('starting'),
    /** The human gate the agent waits at, for example `LOGIN` or `CAPTCHA`; null while the agent works. */
    gate: text('gate'),
    /** A short line for the rail and the control room, for example "Page 2 of 9". No values. */
    progressText: text('progress_text'),
    fieldsTotal: integer('fields_total').notNull().default(0),
    fieldsDone: integer('fields_done').notNull().default(0),
    /** Which browser node holds the session. */
    node: text('node'),
    /** The egress IP the portal sees (proposed G23). */
    egressIp: text('egress_ip'),
    viewers: jsonb('viewers').$type<LiveBrowserViewer[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** done | cancelled | idle | max_time | kill_switch | error */
    endReason: text('end_reason'),
  },
  (t) => ({
    engagementIdx: index('live_browser_sessions_engagement_idx').on(t.engagementId, t.createdAt),
    statusIdx: index('live_browser_sessions_status_idx').on(t.status),
    loginIdx: index('live_browser_sessions_login_idx').on(t.portalLoginLabel),
  }),
);

export const gstnSessions = pgTable('gstn_sessions', {
  gstin: text('gstin').primaryKey(),
  engagementId: uuid('engagement_id')
    .notNull()
    .references(() => base.engagements.id, { onDelete: 'cascade' }),
  /** inactive | active | dormant */
  status: text('status').notNull().default('inactive'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  establishedBy: uuid('established_by').references(() => base.profiles.id, { onDelete: 'set null' }),
  establishedAt: timestamp('established_at', { withTimezone: true }),
  refreshedAt: timestamp('refreshed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export interface GstReturnChecks {
  figures?: { by: string; at: string };
  unmatched?: { by: string; at: string };
}

export const gstReturnRuns = pgTable(
  'gst_return_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => base.engagements.id, { onDelete: 'cascade' }),
    gstin: text('gstin').notNull(),
    /** gstr1 | gstr3b | gstr9 | gstr9c */
    form: text('form').notNull(),
    /** MMYYYY for monthly returns; 03YYYY for annual ones (the GSP's `ret_period`). */
    period: text('period').notNull(),
    /** draft | consent_needed | saving | saved | checked | filing | filed | failed | cancelled */
    status: text('status').notNull().default('draft'),
    /** The portal's own figures after save (liability, ITC, cash, interest); numbers only. */
    summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
    referenceId: text('reference_id'),
    arn: text('arn'),
    checks: jsonb('checks').$type<GstReturnChecks>().notNull().default({}),
    error: text('error'),
    createdBy: uuid('created_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    filedAt: timestamp('filed_at', { withTimezone: true }),
  },
  (t) => ({
    engagementIdx: index('gst_return_runs_engagement_idx').on(t.engagementId, t.createdAt),
    periodIdx: index('gst_return_runs_period_idx').on(t.gstin, t.form, t.period),
  }),
);

export const agentOtpRequests = pgTable(
  'agent_otp_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => base.engagements.id, { onDelete: 'cascade' }),
    /** gstn_consent | evc */
    purpose: text('purpose').notNull(),
    /** gst_return_run | gstn_session | live_browser_session */
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    gstin: text('gstin'),
    /** Where the OTP went, as the portal shows it, for example "mobile ending 4821". */
    sentTo: text('sent_to'),
    /** staff | client: who is asked to type it. */
    audience: text('audience').notNull().default('staff'),
    /** pending | answered | expired | cancelled | failed */
    status: text('status').notNull().default('pending'),
    requestedBy: uuid('requested_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    answeredBy: uuid('answered_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    engagementIdx: index('agent_otp_requests_engagement_idx').on(t.engagementId, t.status),
  }),
);

export const gstNotices = pgTable(
  'gst_notices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => base.engagements.id, { onDelete: 'cascade' }),
    gstin: text('gstin').notNull(),
    refId: text('ref_id').notNull(),
    arn: text('arn'),
    noticeType: text('notice_type'),
    issuedOn: date('issued_on'),
    dueOn: date('due_on'),
    period: text('period'),
    /** open | replied | closed */
    state: text('state').notNull().default('open'),
    /** The notice detail as the GSP returns it, without document bodies. */
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    refUnique: uniqueIndex('gst_notices_ref_unique').on(t.gstin, t.refId),
    engagementIdx: index('gst_notices_engagement_idx').on(t.engagementId, t.state),
  }),
);
