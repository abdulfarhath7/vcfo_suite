ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'general' NOT NULL;
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "author_role" text;
