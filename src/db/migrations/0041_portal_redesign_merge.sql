-- Our portal-branch additions (WhatsApp send variables, Ask VCFO official updates and review,
-- registered office NOCs, planner blocks). Written idempotent: the same file was applied as 0033 on
-- local databases before main took 0033 to 0040, so every statement skips what already exists.
CREATE TABLE IF NOT EXISTS "registered_office_nocs" (
	"engagement_id" uuid PRIMARY KEY NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"file_name" text NOT NULL,
	"generated_key" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" uuid,
	"sent_at" timestamp with time zone,
	"sent_by" uuid,
	"sent_to" text,
	"signed_key" text,
	"signed_file_name" text,
	"signed_at" timestamp with time zone,
	"signed_by" uuid,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "planner_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_by" uuid,
	"engagement_id" uuid,
	"item_ref" text,
	"title" text NOT NULL,
	"day" date NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN IF NOT EXISTS "feed_id" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN IF NOT EXISTS "external_id" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN IF NOT EXISTS "published_at" date;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN IF NOT EXISTS "summary" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN IF NOT EXISTS "review_status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN IF NOT EXISTS "review_note" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN IF NOT EXISTS "review_pdf_key" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN IF NOT EXISTS "variables" jsonb;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN IF NOT EXISTS "retry_of" uuid;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_generated_by_profiles_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_sent_by_profiles_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_signed_by_profiles_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "planner_blocks" ADD CONSTRAINT "planner_blocks_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "planner_blocks" ADD CONSTRAINT "planner_blocks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "planner_blocks" ADD CONSTRAINT "planner_blocks_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "planner_blocks_owner_day_idx" ON "planner_blocks" USING btree ("owner_id","day");--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ask_documents" ADD CONSTRAINT "ask_documents_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_retry_of_notification_deliveries_id_fk" FOREIGN KEY ("retry_of") REFERENCES "public"."notification_deliveries"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ask_documents_feed_external_uq" ON "ask_documents" USING btree ("feed_id","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ask_documents_review_status_idx" ON "ask_documents" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_deliveries_retry_of_idx" ON "notification_deliveries" USING btree ("retry_of");