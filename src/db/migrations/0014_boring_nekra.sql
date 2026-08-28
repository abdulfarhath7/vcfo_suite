-- Project change requests — manager asks, admin approves.
--
-- NOTE: drizzle-kit generated a much larger file here because the schema
-- snapshot had drifted behind tables that already exist in the database
-- (announcement_sources, announcements, engagement_leads, engagement_managers,
-- knowledge_bank_folders, outlook_connections and several ADD COLUMNs). Those
-- statements were removed by hand — re-running them would fail with
-- "relation already exists". The generated snapshot is kept intact so future
-- `db:generate` runs diff against the real state. Only the genuinely new
-- table remains below.

CREATE TABLE "engagement_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_by_name" text,
	"reason" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preview" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decided_by" uuid,
	"decided_by_name" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engagement_change_requests" ADD CONSTRAINT "engagement_change_requests_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_change_requests" ADD CONSTRAINT "engagement_change_requests_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_change_requests" ADD CONSTRAINT "engagement_change_requests_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engagement_change_requests_engagement_idx" ON "engagement_change_requests" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "engagement_change_requests_status_idx" ON "engagement_change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "engagement_change_requests_requester_idx" ON "engagement_change_requests" USING btree ("requested_by");
