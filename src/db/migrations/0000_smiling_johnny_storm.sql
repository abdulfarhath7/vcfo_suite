CREATE TYPE "public"."engagement_health" AS ENUM('on-track', 'at-risk', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."trak_role" AS ENUM('manager', 'intern', 'client');--> statement-breakpoint
CREATE TYPE "public"."engagement_stage" AS ENUM('Pre-Incorporation', 'Post-Incorporation', 'Operational Readiness');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid,
	"actor_id" uuid,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"actor_role" "trak_role" NOT NULL,
	"actor_email" text,
	"actor_name" text,
	"engagement_id" uuid,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_date" date NOT NULL,
	"due_date" date NOT NULL,
	"particular" text NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"notes" text,
	"filed_on" date,
	"filed_note" text,
	"evidence_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"obligation_id" text NOT NULL,
	"due_date" date NOT NULL,
	"period_start" date,
	"period_end" date,
	"period_label" text,
	"fy_label" text,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"owner_id" uuid,
	"filed_on" date,
	"filed_note" text,
	"evidence_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_obligations" (
	"id" text PRIMARY KEY NOT NULL,
	"compliance_area" text NOT NULL,
	"particular" text NOT NULL,
	"authority" text NOT NULL,
	"frequency" text NOT NULL,
	"trigger_type" text NOT NULL,
	"due_rule" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"applies_to" jsonb DEFAULT '{"company":true,"llp":true,"partnership":true,"proprietorship":true}'::jsonb NOT NULL,
	"applicability_note" text,
	"is_conditional" boolean DEFAULT false NOT NULL,
	"penalty_risk" text DEFAULT 'low' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"requested_by" uuid,
	"title" text NOT NULL,
	"detail" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"key" text PRIMARY KEY NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_templates_storage_path_unique" UNIQUE("storage_path")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"category" text,
	"file_name" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"uploaded_by" uuid,
	"step_id" text,
	"shared_with_client" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_send_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"checklist_item_id" text NOT NULL,
	"trigger_event" text NOT NULL,
	"binding_id" uuid NOT NULL,
	"occurrence_key" text NOT NULL,
	"template_id" uuid,
	"status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_template_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"checklist_item_id" text NOT NULL,
	"trigger_event" text NOT NULL,
	"to_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cc_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bcc_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text,
	"from_identity" text DEFAULT 'firm_default' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_board_resolutions" (
	"engagement_id" uuid PRIMARY KEY NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"drafted_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"finalized_by" uuid,
	"template_fingerprint" text,
	"storage_path" text,
	"signed_storage_path" text,
	"signed_uploaded_at" timestamp with time zone,
	"signed_uploaded_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_compliance_triggers" (
	"engagement_id" uuid PRIMARY KEY NOT NULL,
	"incorporation_date" date,
	"gst_registration_date" date,
	"tan_registration_date" date,
	"pf_registration_date" date,
	"esi_registration_date" date,
	"pt_registration_date" date,
	"tds_liability_start_date" date,
	"agm_date" date,
	"has_foreign_investment" boolean DEFAULT false NOT NULL,
	"gst_qrmp" boolean DEFAULT false NOT NULL,
	"sez_unit" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"company_name" text NOT NULL,
	"company_type" text DEFAULT 'domestic' NOT NULL,
	"entity_legal_form" text DEFAULT 'company' NOT NULL,
	"incorporation_date" date,
	"parent_entity_name" text,
	"parent_entity_address" text,
	"parent_entity_registration_number" text,
	"client_id" text NOT NULL,
	"client_user_id" uuid,
	"intern_id" text NOT NULL,
	"admin_id" uuid,
	"client_name" text,
	"stage" "engagement_stage" DEFAULT 'Pre-Incorporation' NOT NULL,
	"health" "engagement_health" DEFAULT 'on-track' NOT NULL,
	"checklist_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"progress_cc_emails" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagements_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"role" "trak_role" DEFAULT 'client' NOT NULL,
	"engagement_id" uuid,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "knowledge_bank_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_bank_files_storage_path_unique" UNIQUE("storage_path")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'unread' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"role" "trak_role" DEFAULT 'client' NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"intern_id" text,
	"client_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid,
	"assigned_to" uuid,
	"title" text NOT NULL,
	"description" text,
	"step_id" text,
	"deadline" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_profiles_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_events" ADD CONSTRAINT "compliance_events_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instances" ADD CONSTRAINT "compliance_instances_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instances" ADD CONSTRAINT "compliance_instances_obligation_id_compliance_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."compliance_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_binding_id_email_template_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."email_template_bindings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_bindings" ADD CONSTRAINT "email_template_bindings_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD CONSTRAINT "engagement_board_resolutions_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD CONSTRAINT "engagement_board_resolutions_finalized_by_profiles_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD CONSTRAINT "engagement_board_resolutions_signed_uploaded_by_profiles_id_fk" FOREIGN KEY ("signed_uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_compliance_triggers" ADD CONSTRAINT "engagement_compliance_triggers_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_client_user_id_profiles_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_admin_id_profiles_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_bank_files" ADD CONSTRAINT "knowledge_bank_files_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_engagement_idx" ON "activity" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "audit_events_engagement_idx" ON "audit_events" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "compliance_events_engagement_due_idx" ON "compliance_events" USING btree ("engagement_id","due_date");--> statement-breakpoint
CREATE INDEX "compliance_instances_engagement_due_idx" ON "compliance_instances" USING btree ("engagement_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_instances_dedupe_idx" ON "compliance_instances" USING btree ("engagement_id","obligation_id","due_date","period_label");--> statement-breakpoint
CREATE INDEX "documents_engagement_idx" ON "documents" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "email_send_log_engagement_created_idx" ON "email_send_log" USING btree ("engagement_id","created_at");--> statement-breakpoint
CREATE INDEX "email_send_log_binding_idx" ON "email_send_log" USING btree ("binding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_send_log_idempotency" ON "email_send_log" USING btree ("engagement_id","checklist_item_id","trigger_event","binding_id","occurrence_key");--> statement-breakpoint
CREATE UNIQUE INDEX "email_template_bindings_unique_pair" ON "email_template_bindings" USING btree ("checklist_item_id","trigger_event","template_id");--> statement-breakpoint
CREATE INDEX "engagements_intern_id_idx" ON "engagements" USING btree ("intern_id");--> statement-breakpoint
CREATE INDEX "engagements_client_user_id_idx" ON "engagements" USING btree ("client_user_id");--> statement-breakpoint
CREATE INDEX "engagements_client_id_idx" ON "engagements" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "tasks_engagement_idx" ON "tasks" USING btree ("engagement_id");