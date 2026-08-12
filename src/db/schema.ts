import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  date,
  jsonb,
  boolean,
  integer,
  bigint,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * VCFO Suite database schema (Drizzle).
 *
 * Ported from the 36 Supabase SQL migrations in the original scaffold.
 * The original relied on Postgres ROW-LEVEL SECURITY for tenant/role isolation.
 * We are taking "Path A" from the replan: access control is enforced in the
 * REPOSITORY layer (src/db/repositories/*) instead of RLS policies.
 *
 * >>> The old RLS policies are the SPEC for those repository filters. <<<
 * See MIGRATION.md and docs/ACCESS-CONTROL.md for the exact rules each
 * repository query must reproduce (e.g. a client may only read an engagement
 * where client_user_id = session.userId OR client_id = session.clientId).
 *
 * RECONCILED (Phase 1) against the original SQL. Things that changed from the
 * first-pass scaffold, and are easy to get wrong again:
 *   - engagement_board_resolutions is keyed by engagement_id (one row each);
 *     the resolution DATE lives in engagements.checklist_state, not a column.
 *   - compliance_obligations.id is a TEXT slug, not a uuid.
 *   - knowledge_bank_files has no visible_to_roles column — role visibility is
 *     a repository rule (manager: all, intern: read + own upload, client: none).
 *   - engagements.progress_cc_emails is text[], and incorporation_date is date.
 *   - document_templates is keyed by its text `key`, with no version column.
 * The `tasks`/`document_requests`/`invites`/`activity`/`notifications` tables
 * below are NEW (they replace localStorage) and have no original SQL.
 */

export const roleEnum = pgEnum('trak_role', [
  'super_admin',
  'admin',
  'manager',
  'intern',
  'client',
]);
export const stageEnum = pgEnum('engagement_stage', [
  'Pre-Incorporation',
  'Post-Incorporation',
  'Operational Readiness',
]);
export const healthEnum = pgEnum('engagement_health', [
  'on-track',
  'at-risk',
  'overdue',
]);

/**
 * Identity + role. In the original this joined Supabase auth.users.
 * With Auth.js we own the users table, so profiles carries auth fields too.
 * `intern_id` / `client_id` are the scoping keys the RLS helpers used
 * (my_intern_id(), my_client_id()) — repositories filter on these.
 */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  // Auth.js Credentials provider: bcrypt hash lives here.
  passwordHash: text('password_hash'),
  name: text('name'),
  role: roleEnum('role').notNull().default('client'),
  phone: text('phone'),
  status: text('status').notNull().default('active'),
  // Scoping keys (mirror the original RLS helper functions).
  internId: text('intern_id'),
  clientId: text('client_id'),
  /** Project lead → Project Manager org chart (Admin Team + PM roster). */
  reportsToManagerId: uuid('reports_to_manager_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The central record. Mirrors EngagementRow in the original engagements-db.ts.
 * checklist_state is the same jsonb blob the domain code already understands
 * (normalizeEngagementChecklistState in src/domain/checklist-state-key.ts).
 */
export const engagements = pgTable(
  'engagements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    companyName: text('company_name').notNull(),
    companyType: text('company_type').notNull().default('domestic'), // domestic | foreign
    entityLegalForm: text('entity_legal_form').notNull().default('company'), // company|llp|partnership|proprietorship
    // SQL type is `date`, not timestamptz — compliance trigger math treats this
    // as a calendar date (see src/lib/compliance/fy-periods.ts).
    incorporationDate: date('incorporation_date'),
    parentEntityName: text('parent_entity_name'),
    parentEntityAddress: text('parent_entity_address'),
    parentEntityRegistrationNumber: text('parent_entity_registration_number'),
    /** India subsidiary / GCC entity — required when starting at Registration or Compliance. */
    subsidiaryLegalName: text('subsidiary_legal_name'),
    subsidiaryRegisteredAddress: text('subsidiary_registered_address'),
    clientId: text('client_id').notNull(),
    clientUserId: uuid('client_user_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    /** Delivery lead — nullable so admins/managers can unassign. */
    internId: text('intern_id'),
    /** Project Manager who owns this engagement (scoped access). */
    managerId: uuid('manager_id').references(() => profiles.id, { onDelete: 'set null' }),
    /** Optional firm Admin who created/oversees (not used for day-to-day scope). */
    adminId: uuid('admin_id').references(() => profiles.id, { onDelete: 'set null' }),
    clientName: text('client_name'),
    stage: stageEnum('stage').notNull().default('Pre-Incorporation'),
    health: healthEnum('health').notNull().default('on-track'),
    checklistState: jsonb('checklist_state').notNull().default({}),
    // SQL type is text[], not jsonb — merge-cc.ts treats it as a string array.
    progressCcEmails: text('progress_cc_emails').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** Soft delete — non-null rows are hidden everywhere except the admin recycle bin. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    internIdx: index('engagements_intern_id_idx').on(t.internId),
    managerIdx: index('engagements_manager_id_idx').on(t.managerId),
    clientUserIdx: index('engagements_client_user_id_idx').on(t.clientUserId),
    clientIdx: index('engagements_client_id_idx').on(t.clientId),
  }),
);

/**
 * Additional (and primary) client users on an engagement.
 * `engagements.client_user_id` remains the primary/owner pointer for legacy
 * callers; membership here is the source of truth for multi-client access.
 */
export const engagementClients = pgTable(
  'engagement_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    /** owner = primary client; member = invited collaborator. */
    memberRole: text('member_role').notNull().default('member'),
    invitedBy: uuid('invited_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('engagement_clients_engagement_idx').on(t.engagementId),
    userIdx: index('engagement_clients_user_idx').on(t.userId),
    uniqueMember: uniqueIndex('engagement_clients_unique').on(t.engagementId, t.userId),
  }),
);

/**
 * Project leads (interns) on an engagement — many per project.
 * `engagements.intern_id` remains the primary/legacy pointer; membership
 * here is the source of truth for multi-lead access.
 */
export const engagementLeads = pgTable(
  'engagement_leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    /** profiles.intern_id scoping key (same as engagements.intern_id). */
    internId: text('intern_id').notNull(),
    invitedBy: uuid('invited_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('engagement_leads_engagement_idx').on(t.engagementId),
    internIdx: index('engagement_leads_intern_idx').on(t.internId),
    uniqueLead: uniqueIndex('engagement_leads_unique').on(t.engagementId, t.internId),
  }),
);

/**
 * Project managers on an engagement — many per project.
 * `engagements.manager_id` remains the primary pointer; membership here
 * grants co-manager access for additional PMs.
 */
export const engagementManagers = pgTable(
  'engagement_managers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    managerId: uuid('manager_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    invitedBy: uuid('invited_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('engagement_managers_engagement_idx').on(t.engagementId),
    managerIdx: index('engagement_managers_manager_idx').on(t.managerId),
    uniqueManager: uniqueIndex('engagement_managers_unique').on(t.engagementId, t.managerId),
  }),
);

/**
 * Draft/finalized/signed board-resolution state + template fingerprint.
 * Reconciled (Phase 1) against 20260525200000_board_resolution.sql and the
 * five ALTERs that followed it (docx, docx_required, template_fingerprint,
 * signed_upload, repair_finalized_storage).
 *
 * NOTE: `engagement_id` is the PRIMARY KEY — exactly one row per engagement.
 * The board-resolution DATE is NOT a column here; it lives in
 * engagements.checklist_state under the pre-1 responses (see the
 * is_valid_pre1_date / assert_pre1_patched_board_resolution_date functions in
 * 20260526140000_board_resolution_date.sql).
 *
 * `storage_path` / `signed_storage_path` now hold S3 object keys rather than
 * Supabase Storage paths. Column names are kept so the ported engagements-db
 * logic reads the same.
 */
export const engagementBoardResolutions = pgTable('engagement_board_resolutions', {
  engagementId: uuid('engagement_id')
    .primaryKey()
    .references(() => engagements.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  status: text('status').notNull().default('draft'), // draft|finalized
  draftedAt: timestamp('drafted_at', { withTimezone: true }),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  finalizedBy: uuid('finalized_by').references(() => profiles.id, { onDelete: 'set null' }),
  templateFingerprint: text('template_fingerprint'),
  storagePath: text('storage_path'),
  signedStoragePath: text('signed_storage_path'),
  signedUploadedAt: timestamp('signed_uploaded_at', { withTimezone: true }),
  signedUploadedBy: uuid('signed_uploaded_by').references(() => profiles.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Uploaded .docx templates. Reconciled against
 * 20260805120000_document_templates.sql — `key` is the PRIMARY KEY (a slug
 * like 'board-resolution'), and there is no version column: uploading a new
 * template replaces the row and its object.
 */
export const documentTemplates = pgTable('document_templates', {
  key: text('key').primaryKey(),
  storagePath: text('storage_path').notNull().unique(), // S3 object key
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  uploadedBy: uuid('uploaded_by')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-engagement documents (certificates, filings, milestone attachments).
 *
 * NOTE: this table has NO counterpart in the original migrations — milestone
 * attachments there were storage-only, keyed by `{engagement_id}/...` object
 * paths and referenced from engagements.checklist_state (see
 * milestone_document_engagement_id() in
 * 20260523160000_milestone_documents_storage.sql). It is kept as the forward
 * home for a real document index, but milestone upload/download still works
 * off object paths — do not assume a row exists for every stored file.
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    category: text('category'), // documents|images|reports|deliverables
    fileName: text('file_name').notNull(),
    objectKey: text('object_key').notNull(), // S3
    contentType: text('content_type'),
    sizeBytes: integer('size_bytes'),
    uploadedBy: uuid('uploaded_by').references(() => profiles.id),
    stepId: text('step_id'), // checklist step this belongs to, if any
    sharedWithClient: boolean('shared_with_client').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('documents_engagement_idx').on(t.engagementId),
  }),
);

/**
 * Shared firm library. Reconciled against 20260529160000_knowledge_bank.sql.
 *
 * ACCESS CONTROL: the original had NO `visible_to_roles` column — visibility
 * was entirely in RLS: manager = ALL, intern = SELECT + INSERT (own uploads),
 * client = no access at all. That rule now lives in the repository, so do not
 * reintroduce a visibility column. `storage_path` holds the S3 object key.
 */
export const knowledgeBankFiles = pgTable('knowledge_bank_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  storagePath: text('storage_path').notNull().unique(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  uploadedBy: uuid('uploaded_by')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Append-only change trail behind the Audit Log view.
 * Reconciled against 20260529120000_audit_events.sql — note the actor
 * email/name are DENORMALISED onto the row so the log still reads correctly
 * after a profile is renamed or deleted, and `summary` is a required
 * human-readable sentence (formatAuditActionLabel in src/lib/audit-log.ts).
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    actorRole: roleEnum('actor_role').notNull(),
    actorEmail: text('actor_email'),
    actorName: text('actor_name'),
    engagementId: uuid('engagement_id').references(() => engagements.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => ({
    engIdx: index('audit_events_engagement_idx').on(t.engagementId),
    createdIdx: index('audit_events_created_idx').on(t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// Email (DB-backed templates/bindings/send_log for checklist lifecycle mail)
// ---------------------------------------------------------------------------
// Reconciled against 20260805150000_email_templates.sql and
// 20260806120000_email_send_log_seeds.sql. Transactional welcome / intern-
// welcome mail uses the shared Resend helper in src/lib/email/send-resend.ts
// (console-skips when RESEND_API_KEY is empty). Checklist-triggered mail can
// bind to email_templates later; do not add a second Resend client.

export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  bodyText: text('body_text'),
  // firm_default | assigned_manager
  fromIdentity: text('from_identity').notNull().default('firm_default'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  updatedBy: uuid('updated_by')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Binds a template to (checklist item, lifecycle trigger). `checklist_item_id`
 * may be '*' to match any step. Recipient rules are jsonb arrays.
 */
export const emailTemplateBindings = pgTable(
  'email_template_bindings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => emailTemplates.id, { onDelete: 'cascade' }),
    checklistItemId: text('checklist_item_id').notNull(),
    // step_entered|awaiting_client|client_submitted|manager_accepted|rejected|
    // delivered_to_client|lead_escalated|completed|overdue
    triggerEvent: text('trigger_event').notNull(),
    toRules: jsonb('to_rules').notNull().default([]),
    ccRules: jsonb('cc_rules').notNull().default([]),
    bccRules: jsonb('bcc_rules').notNull().default([]),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniquePair: uniqueIndex('email_template_bindings_unique_pair').on(
      t.checklistItemId,
      t.triggerEvent,
      t.templateId,
    ),
  }),
);

/**
 * Idempotency ledger for lifecycle emails. The UNIQUE constraint is the whole
 * point: `occurrence_key` makes a retry a no-op rather than a duplicate send.
 */
export const emailSendLog = pgTable(
  'email_send_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    checklistItemId: text('checklist_item_id').notNull(),
    triggerEvent: text('trigger_event').notNull(),
    bindingId: uuid('binding_id')
      .notNull()
      .references(() => emailTemplateBindings.id, { onDelete: 'cascade' }),
    occurrenceKey: text('occurrence_key').notNull(),
    templateId: uuid('template_id').references(() => emailTemplates.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull(), // pending|sent|skipped|failed
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engCreatedIdx: index('email_send_log_engagement_created_idx').on(
      t.engagementId,
      t.createdAt,
    ),
    bindingIdx: index('email_send_log_binding_idx').on(t.bindingId),
    idempotency: uniqueIndex('email_send_log_idempotency').on(
      t.engagementId,
      t.checklistItemId,
      t.triggerEvent,
      t.bindingId,
      t.occurrenceKey,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Compliance calendar
// Reconciled (Phase 1) against the original SQL:
//   20260708120000_compliance_calendar.sql  (base tables)
//   20260805130000_compliance_v2.sql        (evidence, trigger flags, events)
//   20260805140000_compliance_v3.sql        (widened event_type set)
// Column shapes match src/lib/compliance/types.ts, which the LIFTed pure
// generation logic (generate-instances.ts, fy-periods.ts) already tests against.
// ---------------------------------------------------------------------------

/** Static obligation library. `id` is a TEXT slug (e.g. 'gst-gstr-3b'), not a uuid. */
export const complianceObligations = pgTable('compliance_obligations', {
  id: text('id').primaryKey(),
  complianceArea: text('compliance_area').notNull(),
  particular: text('particular').notNull(),
  authority: text('authority').notNull(),
  frequency: text('frequency').notNull(), // monthly|quarterly|half-yearly|annual|one-time
  triggerType: text('trigger_type').notNull(),
  dueRule: jsonb('due_rule').notNull().default({}),
  appliesTo: jsonb('applies_to')
    .notNull()
    .default({ company: true, llp: true, partnership: true, proprietorship: true }),
  applicabilityNote: text('applicability_note'),
  isConditional: boolean('is_conditional').notNull().default(false),
  penaltyRisk: text('penalty_risk').notNull().default('low'),
});

/** One row per engagement — the anchor dates that drive instance generation. */
export const engagementComplianceTriggers = pgTable('engagement_compliance_triggers', {
  engagementId: uuid('engagement_id')
    .primaryKey()
    .references(() => engagements.id, { onDelete: 'cascade' }),
  incorporationDate: date('incorporation_date'),
  gstRegistrationDate: date('gst_registration_date'),
  tanRegistrationDate: date('tan_registration_date'),
  pfRegistrationDate: date('pf_registration_date'),
  esiRegistrationDate: date('esi_registration_date'),
  ptRegistrationDate: date('pt_registration_date'),
  tdsLiabilityStartDate: date('tds_liability_start_date'),
  agmDate: date('agm_date'),
  // v2 conditional flags
  hasForeignInvestment: boolean('has_foreign_investment').notNull().default(false),
  gstQrmp: boolean('gst_qrmp').notNull().default(false),
  sezUnit: boolean('sez_unit').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const complianceInstances = pgTable(
  'compliance_instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    obligationId: text('obligation_id')
      .notNull()
      .references(() => complianceObligations.id),
    dueDate: date('due_date').notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    periodLabel: text('period_label'),
    fyLabel: text('fy_label'),
    status: text('status').notNull().default('upcoming'), // upcoming|in-progress|filed|overdue
    ownerId: uuid('owner_id'),
    filedOn: date('filed_on'),
    // v2 evidence
    filedNote: text('filed_note'),
    evidenceUrl: text('evidence_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engDueIdx: index('compliance_instances_engagement_due_idx').on(t.engagementId, t.dueDate),
    // Mirrors UNIQUE (engagement_id, obligation_id, due_date, period_label) —
    // this is what makes regeneration idempotent.
    dedupeIdx: uniqueIndex('compliance_instances_dedupe_idx').on(
      t.engagementId,
      t.obligationId,
      t.dueDate,
      t.periodLabel,
    ),
  }),
);

/** Manual event-based filings (ROC / FEMA). Not generated — entered by hand. */
export const complianceEvents = pgTable(
  'compliance_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    // v3 set: director_appointment|share_allotment|fc_gpr|ben_2|chg_1|mgt_14|other
    eventType: text('event_type').notNull(),
    eventDate: date('event_date').notNull(),
    dueDate: date('due_date').notNull(),
    particular: text('particular').notNull(),
    status: text('status').notNull().default('upcoming'),
    notes: text('notes'),
    filedOn: date('filed_on'),
    filedNote: text('filed_note'),
    evidenceUrl: text('evidence_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engDueIdx: index('compliance_events_engagement_due_idx').on(t.engagementId, t.dueDate),
  }),
);

// ---------------------------------------------------------------------------
// NEW tables — the "localStorage last mile" from the replan.
// These held per-browser state in the original browser scaffold (vcfo.tasks, vcfo.requests, …).
// Moving them to Postgres is what makes work resumable on any machine and
// gives the compliance product a real server-side trail.
// ---------------------------------------------------------------------------
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id').references(() => engagements.id, {
      onDelete: 'cascade',
    }),
    assignedTo: uuid('assigned_to').references(() => profiles.id),
    title: text('title').notNull(),
    description: text('description'),
    stepId: text('step_id'),
    deadline: timestamp('deadline', { withTimezone: true }),
    status: text('status').notNull().default('open'), // open|in-progress|done
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assigneeIdx: index('tasks_assignee_idx').on(t.assignedTo),
    engIdx: index('tasks_engagement_idx').on(t.engagementId),
  }),
);

export const documentRequests = pgTable('document_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  engagementId: uuid('engagement_id')
    .notNull()
    .references(() => engagements.id, { onDelete: 'cascade' }),
  requestedBy: uuid('requested_by').references(() => profiles.id),
  title: text('title').notNull(),
  detail: text('detail'),
  status: text('status').notNull().default('pending'), // pending|fulfilled|cancelled
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  email: text('email').notNull(),
  role: roleEnum('role').notNull().default('client'),
  engagementId: uuid('engagement_id').references(() => engagements.id, {
    onDelete: 'cascade',
  }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activity = pgTable(
  'activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id').references(() => engagements.id, {
      onDelete: 'cascade',
    }),
    actorId: uuid('actor_id').references(() => profiles.id),
    kind: text('kind').notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('activity_engagement_idx').on(t.engagementId),
  }),
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('unread'), // unread|read
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('notifications_user_idx').on(t.userId),
  }),
);
