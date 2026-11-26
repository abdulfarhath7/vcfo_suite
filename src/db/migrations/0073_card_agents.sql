CREATE TABLE "agent_otp_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"gstin" text,
	"sent_to" text,
	"audience" text DEFAULT 'staff' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_by" uuid,
	"answered_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gst_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"gstin" text NOT NULL,
	"ref_id" text NOT NULL,
	"arn" text,
	"notice_type" text,
	"issued_on" date,
	"due_on" date,
	"period" text,
	"state" text DEFAULT 'open' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gst_return_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"gstin" text NOT NULL,
	"form" text NOT NULL,
	"period" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reference_id" text,
	"arn" text,
	"checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"filed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gstn_sessions" (
	"gstin" text PRIMARY KEY NOT NULL,
	"engagement_id" uuid NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"expires_at" timestamp with time zone,
	"established_by" uuid,
	"established_at" timestamp with time zone,
	"refreshed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_browser_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"run_id" uuid,
	"started_by" uuid,
	"started_by_name" text,
	"portal_host" text,
	"portal_login_label" text,
	"status" text DEFAULT 'starting' NOT NULL,
	"gate" text,
	"progress_text" text,
	"fields_total" integer DEFAULT 0 NOT NULL,
	"fields_done" integer DEFAULT 0 NOT NULL,
	"node" text,
	"egress_ip" text,
	"viewers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" text
);
--> statement-breakpoint
ALTER TABLE "agent_otp_requests" ADD CONSTRAINT "agent_otp_requests_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_otp_requests" ADD CONSTRAINT "agent_otp_requests_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_otp_requests" ADD CONSTRAINT "agent_otp_requests_answered_by_profiles_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_settings" ADD CONSTRAINT "agent_settings_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_notices" ADD CONSTRAINT "gst_notices_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_return_runs" ADD CONSTRAINT "gst_return_runs_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_return_runs" ADD CONSTRAINT "gst_return_runs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gstn_sessions" ADD CONSTRAINT "gstn_sessions_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gstn_sessions" ADD CONSTRAINT "gstn_sessions_established_by_profiles_id_fk" FOREIGN KEY ("established_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_browser_sessions" ADD CONSTRAINT "live_browser_sessions_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_browser_sessions" ADD CONSTRAINT "live_browser_sessions_started_by_profiles_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_otp_requests_engagement_idx" ON "agent_otp_requests" USING btree ("engagement_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "gst_notices_ref_unique" ON "gst_notices" USING btree ("gstin","ref_id");--> statement-breakpoint
CREATE INDEX "gst_notices_engagement_idx" ON "gst_notices" USING btree ("engagement_id","state");--> statement-breakpoint
CREATE INDEX "gst_return_runs_engagement_idx" ON "gst_return_runs" USING btree ("engagement_id","created_at");--> statement-breakpoint
CREATE INDEX "gst_return_runs_period_idx" ON "gst_return_runs" USING btree ("gstin","form","period");--> statement-breakpoint
CREATE INDEX "live_browser_sessions_engagement_idx" ON "live_browser_sessions" USING btree ("engagement_id","created_at");--> statement-breakpoint
CREATE INDEX "live_browser_sessions_status_idx" ON "live_browser_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "live_browser_sessions_login_idx" ON "live_browser_sessions" USING btree ("portal_login_label");