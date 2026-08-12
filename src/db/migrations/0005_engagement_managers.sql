CREATE TABLE IF NOT EXISTS "engagement_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"manager_id" uuid NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "engagement_managers" ADD CONSTRAINT "engagement_managers_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "engagement_managers" ADD CONSTRAINT "engagement_managers_manager_id_profiles_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "engagement_managers" ADD CONSTRAINT "engagement_managers_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_managers_engagement_idx" ON "engagement_managers" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_managers_manager_idx" ON "engagement_managers" USING btree ("manager_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "engagement_managers_unique" ON "engagement_managers" USING btree ("engagement_id","manager_id");--> statement-breakpoint
-- Backfill primary manager from engagements.manager_id
INSERT INTO "engagement_managers" ("engagement_id", "manager_id")
SELECT "id", "manager_id" FROM "engagements"
WHERE "manager_id" IS NOT NULL
ON CONFLICT DO NOTHING;
