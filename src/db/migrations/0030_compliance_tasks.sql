CREATE TABLE "export_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"format" text NOT NULL,
	"file_name" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"made_by" uuid,
	"object_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failed_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_addresses" jsonb NOT NULL,
	"cc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reply_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"from_address" text,
	"subject" text NOT NULL,
	"template_key" text,
	"html" text NOT NULL,
	"text_body" text NOT NULL,
	"had_attachments" boolean DEFAULT false NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"activity_group" text NOT NULL,
	"frequency" text NOT NULL,
	"module" text NOT NULL,
	"area" text NOT NULL,
	"due_rule" text DEFAULT '' NOT NULL,
	"penalty" text DEFAULT '' NOT NULL,
	"applies" text DEFAULT '' NOT NULL,
	"owner_role" text DEFAULT '' NOT NULL,
	"reviewer_role" text DEFAULT '' NOT NULL,
	"notify_days" integer NOT NULL,
	"visibility" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"confirm" text,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"source" text DEFAULT 'master' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_instance_workflow" (
	"instance_id" uuid PRIMARY KEY NOT NULL,
	"engagement_id" uuid NOT NULL,
	"stage" text DEFAULT 'not-started' NOT NULL,
	"reviewer_id" uuid,
	"notify_days" integer,
	"submitted_at" timestamp with time zone,
	"submitted_by" uuid,
	"review_note" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"reminder_key" text NOT NULL,
	"sent_on" date NOT NULL,
	"recipient_id" uuid NOT NULL,
	"notification_id" uuid,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_reminder_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"reminder_key" text NOT NULL,
	"offset_days" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"engagement_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime" text,
	"size_bytes" integer,
	"is_deliverable" boolean DEFAULT false NOT NULL,
	"by_client" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_task_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"done_by" uuid,
	"done_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_task_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_id" uuid,
	"label" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"activity_id" text,
	"name" text NOT NULL,
	"period_label" text,
	"start_date" date NOT NULL,
	"due_date" date NOT NULL,
	"urgency" text DEFAULT 'Medium' NOT NULL,
	"visibility" text DEFAULT 'firm' NOT NULL,
	"owner_id" uuid,
	"reviewer_id" uuid,
	"stage" text DEFAULT 'not-started' NOT NULL,
	"repeats" text DEFAULT 'one-time' NOT NULL,
	"remind_before" integer DEFAULT 5 NOT NULL,
	"series_id" uuid,
	"previous_id" uuid,
	"review_note" text,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"approved_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_obligations" ADD COLUMN "activity_id" text;--> statement-breakpoint
ALTER TABLE "export_files" ADD CONSTRAINT "export_files_made_by_profiles_id_fk" FOREIGN KEY ("made_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_activities" ADD CONSTRAINT "compliance_activities_confirmed_by_profiles_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_activities" ADD CONSTRAINT "compliance_activities_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_workflow" ADD CONSTRAINT "compliance_instance_workflow_instance_id_compliance_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."compliance_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_workflow" ADD CONSTRAINT "compliance_instance_workflow_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_workflow" ADD CONSTRAINT "compliance_instance_workflow_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_workflow" ADD CONSTRAINT "compliance_instance_workflow_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_instance_workflow" ADD CONSTRAINT "compliance_instance_workflow_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reminder_log" ADD CONSTRAINT "compliance_reminder_log_recipient_id_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reminder_overrides" ADD CONSTRAINT "compliance_reminder_overrides_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reminder_overrides" ADD CONSTRAINT "compliance_reminder_overrides_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_task_attachments" ADD CONSTRAINT "compliance_task_attachments_task_id_compliance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."compliance_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_task_attachments" ADD CONSTRAINT "compliance_task_attachments_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_task_attachments" ADD CONSTRAINT "compliance_task_attachments_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_task_checklist_items" ADD CONSTRAINT "compliance_task_checklist_items_task_id_compliance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."compliance_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_task_checklist_items" ADD CONSTRAINT "compliance_task_checklist_items_done_by_profiles_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_task_checklist_items" ADD CONSTRAINT "compliance_task_checklist_items_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_task_comments" ADD CONSTRAINT "compliance_task_comments_task_id_compliance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."compliance_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_task_comments" ADD CONSTRAINT "compliance_task_comments_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_task_events" ADD CONSTRAINT "compliance_task_events_task_id_compliance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."compliance_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_task_events" ADD CONSTRAINT "compliance_task_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_activity_id_compliance_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."compliance_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "export_files_created_idx" ON "export_files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "failed_emails_created_idx" ON "failed_emails" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_reminder_log_uq" ON "compliance_reminder_log" USING btree ("subject_kind","subject_id","reminder_key","sent_on","recipient_id");--> statement-breakpoint
CREATE INDEX "compliance_reminder_log_subject_idx" ON "compliance_reminder_log" USING btree ("subject_kind","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_reminder_overrides_uq" ON "compliance_reminder_overrides" USING btree ("subject_kind","subject_id","reminder_key");--> statement-breakpoint
CREATE INDEX "compliance_task_attachments_task_idx" ON "compliance_task_attachments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "compliance_task_checklist_items_task_idx" ON "compliance_task_checklist_items" USING btree ("task_id","position");--> statement-breakpoint
CREATE INDEX "compliance_task_comments_task_idx" ON "compliance_task_comments" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "compliance_task_events_task_idx" ON "compliance_task_events" USING btree ("task_id","at");--> statement-breakpoint
CREATE INDEX "compliance_tasks_engagement_due_idx" ON "compliance_tasks" USING btree ("engagement_id","due_date");--> statement-breakpoint
CREATE INDEX "compliance_tasks_owner_idx" ON "compliance_tasks" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_tasks_series_due_idx" ON "compliance_tasks" USING btree ("series_id","due_date");