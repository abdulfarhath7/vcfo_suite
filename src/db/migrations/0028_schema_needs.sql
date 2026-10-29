CREATE TABLE "compliance_checklist_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_key" text NOT NULL,
	"item_key" text NOT NULL,
	"checked_by" uuid,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"side" text NOT NULL,
	"label" text NOT NULL,
	"actor_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_snapshots" (
	"period" date NOT NULL,
	"key" text NOT NULL,
	"scope" text DEFAULT 'firm' NOT NULL,
	"value" numeric NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kpi_snapshots_period_key_scope_pk" PRIMARY KEY("period","key","scope")
);
--> statement-breakpoint
CREATE TABLE "step_field_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"field_id" text NOT NULL,
	"state" text NOT NULL,
	"asked_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"actor_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "sent_to_client_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "sent_to_client_by" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "designation" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "membership_no" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assigned_by" uuid;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD COLUMN "remind_days" smallint;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD COLUMN "digest_time" text;--> statement-breakpoint
ALTER TABLE "engagement_step_events" ADD COLUMN "holder" text;--> statement-breakpoint
ALTER TABLE "compliance_checklist_checks" ADD CONSTRAINT "compliance_checklist_checks_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checklist_checks" ADD CONSTRAINT "compliance_checklist_checks_checked_by_profiles_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filing_events" ADD CONSTRAINT "filing_events_instance_id_compliance_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."compliance_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filing_events" ADD CONSTRAINT "filing_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_field_states" ADD CONSTRAINT "step_field_states_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_field_states" ADD CONSTRAINT "step_field_states_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_checklist_checks_uq" ON "compliance_checklist_checks" USING btree ("engagement_id","subject_kind","subject_key","item_key");--> statement-breakpoint
CREATE INDEX "filing_events_instance_idx" ON "filing_events" USING btree ("instance_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "step_field_states_field_uq" ON "step_field_states" USING btree ("engagement_id","item_id","field_id");--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD CONSTRAINT "engagement_board_resolutions_sent_to_client_by_profiles_id_fk" FOREIGN KEY ("sent_to_client_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_by_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;