/**
 * VCFO Assist agents (docs/specs/vcfo-assist-agents/PLAN.md): the run log and the recipe patch
 * review queue. Re-exported from src/db/schema.ts.
 *
 * Circular import note: this file is evaluated BEFORE schema.ts's body, so `base.*` may only be
 * touched lazily, inside `.references(() => base.profiles.id)` callbacks.
 *
 * Tables:
 *  - assist_agent_runs      one sub-agent run in the extension, with its counters and the SRN it read.
 *  - assist_recipe_patches  a field fix the heal ladder found (T1, T3 or T4); staff approve or reject it.
 *  - assist_run_attestations the certifier's due-diligence checks for one run (SAFETY.md G17), one per run.
 *
 * Retention (SAFETY.md G14, DPDP Rule 8(3)): runs and attestations are evidence and are kept for at
 * least one year. No job deletes them. Deleting a staff account no longer deletes that person's
 * runs (0051 made `user_id` and `certifier_id` ON DELETE SET NULL, and the name and email are kept
 * on the row). An engagement is only ever soft-deleted by the app; the demo purge and seed scripts
 * hard-delete engagements and must never run on a database that holds real runs.
 *
 * `assist_agent_runs` is not `assist_runs` (0029, `schema-portal-compliances.ts`): that older table is
 * the "Start filing" state per filing period or registration, which clients also read. Agent runs
 * are staff-only telemetry (heals, refusals, tokens) keyed by catalog sub-agent and recipe.
 *
 * Neither table holds a profile value. Heals and evidence carry field keys and labels only.
 */
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import type {
  AssistAttestationChecks,
  AssistBlank,
  AssistClientIp,
  AssistDevice,
  AssistDscSigner,
  AssistHeal,
  AssistPatchEvidence,
  AssistPatchProposal,
  AssistRefusal,
} from '@/lib/assist-agents/types';
import * as base from './schema';

export const assistAgentRuns = pgTable(
  'assist_agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => base.engagements.id, { onDelete: 'cascade' }),
    /** Null only once the Suite account is deleted (0051); `user_name` / `user_email` still say who. */
    userId: uuid('user_id').references(() => base.profiles.id, { onDelete: 'set null' }),
    /** Evidence: the Suite user's name and email when the run started, kept if the account goes. */
    userName: text('user_name'),
    userEmail: text('user_email'),
    /** Catalog agent id, for example `incorporation`. */
    agent: text('agent').notNull(),
    /** Catalog sub-agent id, for example `spice-a`. */
    subAgent: text('sub_agent').notNull(),
    recipeId: text('recipe_id').notNull(),
    recipeVersion: text('recipe_version').notNull(),
    status: text('status').notNull().default('running'), // running|waiting_user|done|failed|cancelled
    /** The run engine's state name, for example `FILL` or `WAIT_DSC`. */
    state: text('state').notNull().default('READY'),
    fieldsTotal: integer('fields_total').notNull().default(0),
    fieldsFilled: integer('fields_filled').notNull().default(0),
    heals: jsonb('heals').$type<AssistHeal[]>().notNull().default([]),
    refusals: jsonb('refusals').$type<AssistRefusal[]>().notNull().default([]),
    aiCalls: integer('ai_calls').notNull().default(0),
    aiTokens: integer('ai_tokens').notNull().default(0),
    srn: text('srn'),
    error: text('error'),
    /** Fields left for the user to fill from the client's records (G16): keys and reasons, no values. */
    blanks: jsonb('blanks').$type<AssistBlank[]>().notNull().default([]),
    /** Evidence: the MCA login the staff member said they used (a user id or email label, never a password). */
    mcaLoginLabel: text('mca_login_label'),
    /** Evidence: who held the DSC for each signature, resolved by Suite from its own records. */
    dscSigners: jsonb('dsc_signers').$type<AssistDscSigner[]>().notNull().default([]),
    /** Evidence: the browser install that ran it (random install id, user agent, extension version). */
    device: jsonb('device').$type<AssistDevice>(),
    /** Evidence: the client IPs Suite saw on this run's API calls, with first and last time and a count. */
    clientIps: jsonb('client_ips').$type<AssistClientIp[]>().notNull().default([]),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    engagementIdx: index('assist_agent_runs_engagement_idx').on(t.engagementId, t.startedAt),
    userIdx: index('assist_agent_runs_user_idx').on(t.userId),
    startedIdx: index('assist_agent_runs_started_idx').on(t.startedAt),
  }),
);

export const assistRecipePatches = pgTable(
  'assist_recipe_patches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipeId: text('recipe_id').notNull(),
    recipeVersion: text('recipe_version').notNull(),
    fieldKey: text('field_key').notNull(),
    /** `{ som?, css?, label? }`: what the recipe field should become. */
    proposed: jsonb('proposed').$type<AssistPatchProposal>().notNull(),
    /** Labels only, never a value. */
    evidence: jsonb('evidence').$type<AssistPatchEvidence>().notNull().default({}),
    sourceTier: text('source_tier').notNull(), // T1|T3|T4
    runId: uuid('run_id').references((): AnyPgColumn => assistAgentRuns.id, { onDelete: 'set null' }),
    proposedBy: uuid('proposed_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('proposed'), // proposed|approved|rejected
    reviewedBy: uuid('reviewed_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('assist_recipe_patches_status_idx').on(t.status, t.createdAt),
    recipeIdx: index('assist_recipe_patches_recipe_idx').on(t.recipeId, t.fieldKey),
    runIdx: index('assist_recipe_patches_run_idx').on(t.runId),
    proposedByIdx: index('assist_recipe_patches_proposed_by_idx').on(t.proposedBy),
    reviewedByIdx: index('assist_recipe_patches_reviewed_by_idx').on(t.reviewedBy),
  }),
);

/**
 * The certifier's due-diligence checks for one agent run (SAFETY.md G17). One row per run, written
 * once and never changed: a correction is a new run. The extension shows the Submit and Pay card
 * only after this row exists.
 */
export const assistRunAttestations = pgTable(
  'assist_run_attestations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references((): AnyPgColumn => assistAgentRuns.id, { onDelete: 'cascade' }),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => base.engagements.id, { onDelete: 'cascade' }),
    certifierId: uuid('certifier_id').references(() => base.profiles.id, { onDelete: 'set null' }),
    /** The certifier's name and email when they attested, kept if the account goes. */
    certifierName: text('certifier_name'),
    certifierEmail: text('certifier_email'),
    /** The confirmed checks, each from the person's own click. */
    checks: jsonb('checks').$type<AssistAttestationChecks>().notNull(),
    /** Documents in this engagement's vault offered as evidence (site photo, NOC, video-KYC record). */
    evidenceDocumentIds: jsonb('evidence_document_ids').$type<string[]>().notNull().default([]),
    note: text('note'),
    /** The request that recorded it: client IP (as App Runner's proxy saw it), forwarded chain, user agent. */
    ip: text('ip'),
    forwardedFor: text('forwarded_for'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runUnique: uniqueIndex('assist_run_attestations_run_unique').on(t.runId),
    engagementIdx: index('assist_run_attestations_engagement_idx').on(t.engagementId),
    certifierIdx: index('assist_run_attestations_certifier_idx').on(t.certifierId),
  }),
);
