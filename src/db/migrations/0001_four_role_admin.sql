-- Four-role split: firm admin + project manager ownership
ALTER TYPE "public"."trak_role" ADD VALUE IF NOT EXISTS 'admin';
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "reports_to_manager_id" uuid;
--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN IF NOT EXISTS "manager_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "engagements" ADD CONSTRAINT "engagements_manager_id_profiles_id_fk"
    FOREIGN KEY ("manager_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagements_manager_id_idx" ON "engagements" USING btree ("manager_id");
--> statement-breakpoint
-- Backfill: previous admin_id was the acting project manager
UPDATE "engagements" SET "manager_id" = "admin_id" WHERE "manager_id" IS NULL AND "admin_id" IS NOT NULL;
