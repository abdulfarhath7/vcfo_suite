CREATE TABLE IF NOT EXISTS "announcement_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"homepage_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "announcement_sources_feed_url_uidx" ON "announcement_sources" USING btree ("feed_url");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "announcement_sources" ADD CONSTRAINT "announcement_sources_created_by_id_profiles_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"external_id" text,
	"source_url" text,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "announcements_published_idx" ON "announcements" USING btree ("published_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "announcements_source_external_uidx" ON "announcements" USING btree ("source_id","external_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "announcements" ADD CONSTRAINT "announcements_source_id_announcement_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."announcement_sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
