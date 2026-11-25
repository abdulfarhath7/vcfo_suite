/**
 * INTEGRATIONS HUB (Zoho Z1, docs/specs/integrations/ZOHO.md): one place for connections to
 * outside systems that hold client data. Today only Zoho, connected once from Firm settings by a
 * firm-wide admin. The `scope` column is kept so a client's own Zoho ('engagement') can come later.
 *
 *  - integration_connections — one OAuth connection; tokens sealed with AUTH_SECRET.
 *  - integration_orgs        — the organisations each Zoho app answered with at discovery.
 *  - integration_links       — a Zoho org, customer or CRM account mapped to a VCFO record.
 *  - integration_sync_jobs   — discovery, field checks and module syncs (shape of tally_sync_jobs).
 *
 * Circular import note: this file is evaluated BEFORE schema.ts's body, so `profiles` and
 * `engagements` may only be touched lazily, inside `.references(() => ...)` callbacks.
 */
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import * as base from './schema';

export type IntegrationProvider = 'zoho';
export type IntegrationScope = 'firm' | 'engagement';
export type IntegrationStatus = 'active' | 'error' | 'revoked';
export type ZohoApp = 'books' | 'invoice' | 'crm' | 'payroll' | 'people';
export type LinkExternalType = 'org' | 'customer' | 'crm_account';
export type LinkVcfoType = 'engagement' | 'receivable_client' | 'firm';
export type LinkMatch = 'auto_gstin' | 'auto_pan' | 'auto_name' | 'suggested' | 'manual';
export type LinkStatus = 'mapped' | 'suggested' | 'unmapped' | 'ignored';
export type SyncJobStatus = 'queued' | 'running' | 'done' | 'failed';

/** What one app answered at discovery: used, not used, or an error the person can read. */
export type OrgCounts = Record<string, number>;

/** One needed field and whether the sample record carried it. */
export type FieldCheckItem = { key: string; label: string; present: boolean | null; note?: string };
export type FieldCheck = { checkedAt: string; items: FieldCheckItem[]; error?: string };

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').$type<IntegrationProvider>().notNull(),
    /** 'firm' only in Z1; 'engagement' is reserved for a client's own Zoho. */
    scope: text('scope').$type<IntegrationScope>().notNull().default('firm'),
    engagementId: uuid('engagement_id').references(() => base.engagements.id, { onDelete: 'cascade' }),
    /** Zoho's `accounts-server` from the callback, for example https://accounts.zoho.in. */
    accountsServer: text('accounts_server').notNull(),
    /** Zoho's `api_domain` from the token reply, for example https://www.zohoapis.in. */
    apiDomain: text('api_domain').notNull(),
    /** Zoho's `location` from the callback (us, in, eu …). */
    location: text('location').notNull(),
    refreshTokenEnc: text('refresh_token_enc').notNull(),
    accessTokenEnc: text('access_token_enc'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    scopes: text('scopes'),
    status: text('status').$type<IntegrationStatus>().notNull().default('active'),
    /** The last error a refresh or call met, in words; cleared on success. */
    lastError: text('last_error'),
    connectedBy: uuid('connected_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** One live firm connection per provider; a reconnect replaces it. */
    firmActive: uniqueIndex('integration_connections_firm_active_idx')
      .on(t.provider)
      .where(sql`scope = 'firm' and revoked_at is null`),
    engagementIdx: index('integration_connections_engagement_idx').on(t.engagementId),
  }),
);

export const integrationOrgs = pgTable(
  'integration_orgs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    app: text('app').$type<ZohoApp>().notNull(),
    externalOrgId: text('external_org_id').notNull(),
    name: text('name').notNull(),
    gstin: text('gstin'),
    pan: text('pan'),
    /** Customers, invoices, employees, pay runs, accounts … as each app counts them. */
    counts: jsonb('counts').$type<OrgCounts>().notNull().default({}),
    fieldCheck: jsonb('field_check').$type<FieldCheck>(),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    oneEach: uniqueIndex('integration_orgs_uq').on(t.connectionId, t.app, t.externalOrgId),
  }),
);

export const integrationLinks = pgTable(
  'integration_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    app: text('app').$type<ZohoApp>().notNull(),
    externalType: text('external_type').$type<LinkExternalType>().notNull(),
    externalId: text('external_id').notNull(),
    externalName: text('external_name').notNull(),
    /** The Zoho organisation a customer belongs to; null for an org or a CRM account. */
    externalOrgId: text('external_org_id'),
    externalGstin: text('external_gstin'),
    externalPan: text('external_pan'),
    /** Null while unmapped or ignored. */
    vcfoType: text('vcfo_type').$type<LinkVcfoType>(),
    /** An engagement id or a receivable client id; null for 'firm'. Not a foreign key (two tables). */
    vcfoId: uuid('vcfo_id'),
    /** The VCFO name at the time of the match, for the review screen. */
    vcfoName: text('vcfo_name'),
    match: text('match').$type<LinkMatch>(),
    status: text('status').$type<LinkStatus>().notNull().default('unmapped'),
    decidedBy: uuid('decided_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    oneEach: uniqueIndex('integration_links_uq').on(t.connectionId, t.app, t.externalType, t.externalId),
    vcfoIdx: index('integration_links_vcfo_idx').on(t.vcfoType, t.vcfoId),
  }),
);

export const integrationSyncJobs = pgTable(
  'integration_sync_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    /** 'all' for discovery, or one app. */
    app: text('app').notNull(),
    /** discover | receivables … */
    module: text('module').notNull(),
    /** What the job is for within the module (a receivable sheet id); '' for discovery. One active job per key. */
    targetKey: text('target_key').notNull().default(''),
    params: jsonb('params').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').$type<SyncJobStatus>().notNull().default('queued'),
    /** Progress and results, for example `{ step: 'books', orgs: 3, matched: 12 }`. */
    stats: jsonb('stats').$type<Record<string, unknown>>().notNull().default({}),
    error: text('error'),
    requestedBy: uuid('requested_by').references(() => base.profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => ({
    connectionIdx: index('integration_sync_jobs_connection_idx').on(t.connectionId, t.createdAt),
    activeIdx: uniqueIndex('integration_sync_jobs_active_idx')
      .on(t.connectionId, t.module, t.targetKey)
      .where(sql`status in ('queued', 'running')`),
  }),
);
