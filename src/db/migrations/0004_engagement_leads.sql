CREATE TABLE IF NOT EXISTS "engagement_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"intern_id" text NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "engagement_leads" ADD CONSTRAINT "engagement_leads_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "engagement_leads" ADD CONSTRAINT "engagement_leads_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_leads_engagement_idx" ON "engagement_leads" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_leads_intern_idx" ON "engagement_leads" USING btree ("intern_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "engagement_leads_unique" ON "engagement_leads" USING btree ("engagement_id","intern_id");--> statement-breakpoint
-- Backfill primary lead from engagements.intern_id
INSERT INTO "engagement_leads" ("engagement_id", "intern_id")
SELECT "id", "intern_id" FROM "engagements"
WHERE "intern_id" IS NOT NULL AND trim("intern_id") <> ''
ON CONFLICT DO NOTHING;
