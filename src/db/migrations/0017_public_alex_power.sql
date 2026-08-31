ALTER TABLE "profiles" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "removed_reason" text;