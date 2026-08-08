-- Idempotent: parts of this diff were already applied to dev DBs via drizzle-kit push,
-- so every statement guards against the object already existing.
ALTER TYPE "public"."trak_role" ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'manager';--> statement-breakpoint
ALTER TYPE "public"."trak_role" ADD VALUE IF NOT EXISTS 'admin' BEFORE 'manager';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"member_role" text DEFAULT 'member' NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN IF NOT EXISTS "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "reports_to_manager_id" uuid;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "engagement_clients" ADD CONSTRAINT "engagement_clients_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "engagement_clients" ADD CONSTRAINT "engagement_clients_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "engagement_clients" ADD CONSTRAINT "engagement_clients_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_clients_engagement_idx" ON "engagement_clients" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_clients_user_idx" ON "engagement_clients" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "engagement_clients_unique" ON "engagement_clients" USING btree ("engagement_id","user_id");--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "engagements" ADD CONSTRAINT "engagements_manager_id_profiles_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagements_manager_id_idx" ON "engagements" USING btree ("manager_id");
