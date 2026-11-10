-- VCFO Assist filing safeguards (docs/specs/vcfo-assist-agents/SAFETY.md G14, G16, G17).
-- Adds the certifier's attestation per run, the run's evidence log (user name and email snapshot,
-- MCA login label, DSC holders, device, client IPs) and the fields left for the client's records.
-- Retention: a deleted staff account no longer deletes its runs (user_id is now ON DELETE SET NULL);
-- runs and attestations are kept for at least one year and no job deletes them.
CREATE TABLE "assist_run_attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"engagement_id" uuid NOT NULL,
	"certifier_id" uuid,
	"certifier_name" text,
	"certifier_email" text,
	"checks" jsonb NOT NULL,
	"evidence_document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"ip" text,
	"forwarded_for" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assist_agent_runs" DROP CONSTRAINT "assist_agent_runs_user_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "assist_agent_runs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "assist_certifier_must_differ" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assist_agent_runs" ADD COLUMN "user_name" text;--> statement-breakpoint
ALTER TABLE "assist_agent_runs" ADD COLUMN "user_email" text;--> statement-breakpoint
ALTER TABLE "assist_agent_runs" ADD COLUMN "blanks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assist_agent_runs" ADD COLUMN "mca_login_label" text;--> statement-breakpoint
ALTER TABLE "assist_agent_runs" ADD COLUMN "dsc_signers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assist_agent_runs" ADD COLUMN "device" jsonb;--> statement-breakpoint
ALTER TABLE "assist_agent_runs" ADD COLUMN "client_ips" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assist_run_attestations" ADD CONSTRAINT "assist_run_attestations_run_id_assist_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."assist_agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_run_attestations" ADD CONSTRAINT "assist_run_attestations_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_run_attestations" ADD CONSTRAINT "assist_run_attestations_certifier_id_profiles_id_fk" FOREIGN KEY ("certifier_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assist_run_attestations_run_unique" ON "assist_run_attestations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "assist_run_attestations_engagement_idx" ON "assist_run_attestations" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "assist_run_attestations_certifier_idx" ON "assist_run_attestations" USING btree ("certifier_id");--> statement-breakpoint
ALTER TABLE "assist_agent_runs" ADD CONSTRAINT "assist_agent_runs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "assist_agent_runs" AS r SET "user_name" = p."name", "user_email" = p."email" FROM "profiles" AS p WHERE p."id" = r."user_id" AND r."user_name" IS NULL;
