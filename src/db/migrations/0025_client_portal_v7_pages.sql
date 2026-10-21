CREATE TABLE "ask_answer_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"message_id" uuid,
	"question" text DEFAULT '' NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"vote" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_need_meta" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"engagement_id" uuid NOT NULL,
	"step_id" text,
	"compliance_instance_id" uuid,
	"kind" text DEFAULT 'upload' NOT NULL,
	"due_date" date,
	"field_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_timeline_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"task_id" uuid,
	"requested_by" uuid NOT NULL,
	"requested_by_name" text,
	"reason" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"step_id" text,
	"title" text NOT NULL,
	"assignee_id" uuid,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"ready_on" date,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_file_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"field_id" text NOT NULL,
	"label" text NOT NULL,
	"note" text,
	"due_date" date,
	"requested_by" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fulfilled_at" timestamp with time zone,
	"fulfilled_by" uuid,
	"fulfilled_path" text,
	"previous_path" text,
	"file_name" text,
	"size_bytes" integer,
	"content_type" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_instance_details" (
	"instance_id" uuid PRIMARY KEY NOT NULL,
	"acknowledgement_no" text,
	"amount_paid" numeric(14, 2),
	"filed_by" uuid,
	"data_received_on" date,
	"preparing_since" date,
	"draft_due_on" date,
	"approval_due_on" date,
	"approved_on" date,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_instance_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"engagement_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime" text,
	"size_bytes" integer,
	"kind" text DEFAULT 'acknowledgement' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"remind_on" date NOT NULL,
	"channels" jsonb DEFAULT '["email"]'::jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_library_reads" (
	"profile_id" uuid NOT NULL,
	"ref" text NOT NULL,
	"item_id" uuid,
	"topic_slug" text,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"sections_read" integer DEFAULT 0 NOT NULL,
	"sections_total" integer DEFAULT 0 NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "client_library_reads_profile_id_ref_pk" PRIMARY KEY("profile_id","ref")
);
--> statement-breakpoint
CREATE TABLE "client_library_removals" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"removed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_request_details" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"engagement_id" uuid NOT NULL,
	"due_on" date,
	"step_id" text,
	"field_id" text,
	"review_note" text,
	"review_note_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_request_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"engagement_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replaced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "client_account_meta" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"password_changed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"profile_id" uuid,
	"invited_by" uuid,
	"temp_password_hash" text,
	"send_count" integer DEFAULT 1 NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"email" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"whatsapp" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quiet_hours" boolean DEFAULT true NOT NULL,
	"quiet_start" text DEFAULT '21:00' NOT NULL,
	"quiet_end" text DEFAULT '08:00' NOT NULL,
	"tz" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credential_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_by" uuid,
	"otp_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credential_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"approver_profile_id" uuid,
	"approver_name" text,
	"mode" text NOT NULL,
	"scope" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"resend_available_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"sheet" text NOT NULL,
	"row_key" text NOT NULL,
	"ordinal" integer DEFAULT 0 NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret_ciphertext" text,
	"edited" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "identifier_reveal_attempts" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ask_answer_feedback" ADD CONSTRAINT "ask_answer_feedback_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_answer_feedback" ADD CONSTRAINT "ask_answer_feedback_message_id_ask_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ask_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_need_meta" ADD CONSTRAINT "client_need_meta_request_id_document_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."document_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_need_meta" ADD CONSTRAINT "client_need_meta_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_timeline_requests" ADD CONSTRAINT "client_timeline_requests_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_timeline_requests" ADD CONSTRAINT "client_timeline_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_timeline_requests" ADD CONSTRAINT "client_timeline_requests_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_timeline_requests" ADD CONSTRAINT "client_timeline_requests_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_work_items" ADD CONSTRAINT "client_work_items_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_work_items" ADD CONSTRAINT "client_work_items_assignee_id_profiles_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_work_items" ADD CONSTRAINT "client_work_items_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_file_requests" ADD CONSTRAINT "client_file_requests_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_file_requests" ADD CONSTRAINT "client_file_requests_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_file_requests" ADD CONSTRAINT "client_file_requests_fulfilled_by_profiles_id_fk" FOREIGN KEY ("fulfilled_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_details" ADD CONSTRAINT "compliance_instance_details_instance_id_compliance_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."compliance_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_details" ADD CONSTRAINT "compliance_instance_details_filed_by_profiles_id_fk" FOREIGN KEY ("filed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_details" ADD CONSTRAINT "compliance_instance_details_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_proofs" ADD CONSTRAINT "compliance_instance_proofs_instance_id_compliance_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."compliance_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_proofs" ADD CONSTRAINT "compliance_instance_proofs_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_proofs" ADD CONSTRAINT "compliance_instance_proofs_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reminders" ADD CONSTRAINT "compliance_reminders_instance_id_compliance_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."compliance_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reminders" ADD CONSTRAINT "compliance_reminders_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_library_reads" ADD CONSTRAINT "client_library_reads_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_library_reads" ADD CONSTRAINT "client_library_reads_item_id_client_library_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."client_library_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_library_removals" ADD CONSTRAINT "client_library_removals_item_id_client_library_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."client_library_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_library_removals" ADD CONSTRAINT "client_library_removals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_request_details" ADD CONSTRAINT "document_request_details_request_id_document_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."document_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_request_details" ADD CONSTRAINT "document_request_details_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_request_details" ADD CONSTRAINT "document_request_details_review_note_by_profiles_id_fk" FOREIGN KEY ("review_note_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_request_files" ADD CONSTRAINT "document_request_files_request_id_document_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."document_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_request_files" ADD CONSTRAINT "document_request_files_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_request_files" ADD CONSTRAINT "document_request_files_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_account_meta" ADD CONSTRAINT "client_account_meta_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_invites" ADD CONSTRAINT "client_invites_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_invites" ADD CONSTRAINT "client_invites_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_invites" ADD CONSTRAINT "client_invites_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_access_grants" ADD CONSTRAINT "credential_access_grants_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_access_grants" ADD CONSTRAINT "credential_access_grants_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_access_grants" ADD CONSTRAINT "credential_access_grants_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_otps" ADD CONSTRAINT "credential_otps_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_otps" ADD CONSTRAINT "credential_otps_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_otps" ADD CONSTRAINT "credential_otps_approver_profile_id_profiles_id_fk" FOREIGN KEY ("approver_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_credentials" ADD CONSTRAINT "engagement_credentials_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_credentials" ADD CONSTRAINT "engagement_credentials_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identifier_reveal_attempts" ADD CONSTRAINT "identifier_reveal_attempts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_answer_feedback_profile_idx" ON "ask_answer_feedback" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "client_need_meta_engagement_idx" ON "client_need_meta" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "client_timeline_requests_engagement_idx" ON "client_timeline_requests" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "client_work_items_engagement_idx" ON "client_work_items" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "client_file_requests_eng_step_idx" ON "client_file_requests" USING btree ("engagement_id","step_id");--> statement-breakpoint
CREATE INDEX "compliance_instance_proofs_instance_idx" ON "compliance_instance_proofs" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "compliance_instance_proofs_engagement_idx" ON "compliance_instance_proofs" USING btree ("engagement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_reminders_instance_user_idx" ON "compliance_reminders" USING btree ("instance_id","user_id");--> statement-breakpoint
CREATE INDEX "compliance_reminders_remind_on_idx" ON "compliance_reminders" USING btree ("remind_on");--> statement-breakpoint
CREATE INDEX "client_library_reads_recent_idx" ON "client_library_reads" USING btree ("profile_id","last_read_at");--> statement-breakpoint
CREATE INDEX "document_request_details_engagement_idx" ON "document_request_details" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "document_request_files_request_idx" ON "document_request_files" USING btree ("request_id","uploaded_at");--> statement-breakpoint
CREATE INDEX "document_request_files_engagement_idx" ON "document_request_files" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "client_invites_engagement_idx" ON "client_invites" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "credential_access_grants_live_idx" ON "credential_access_grants" USING btree ("profile_id","engagement_id","expires_at");--> statement-breakpoint
CREATE INDEX "credential_otps_requester_idx" ON "credential_otps" USING btree ("requested_by","engagement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "engagement_credentials_row_uq" ON "engagement_credentials" USING btree ("engagement_id","sheet","row_key");--> statement-breakpoint
CREATE INDEX "engagement_credentials_engagement_idx" ON "engagement_credentials" USING btree ("engagement_id");