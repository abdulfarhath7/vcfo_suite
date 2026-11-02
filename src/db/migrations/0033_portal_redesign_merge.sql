CREATE TABLE "registered_office_nocs" (
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
CREATE TABLE "planner_blocks" (
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
ALTER TABLE "ask_documents" ADD COLUMN "feed_id" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "published_at" date;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "review_status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "review_pdf_key" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "variables" jsonb;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "retry_of" uuid;--> statement-breakpoint
ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_generated_by_profiles_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_sent_by_profiles_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_signed_by_profiles_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_blocks" ADD CONSTRAINT "planner_blocks_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_blocks" ADD CONSTRAINT "planner_blocks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_blocks" ADD CONSTRAINT "planner_blocks_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planner_blocks_owner_day_idx" ON "planner_blocks" USING btree ("owner_id","day");--> statement-breakpoint
ALTER TABLE "ask_documents" ADD CONSTRAINT "ask_documents_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_retry_of_notification_deliveries_id_fk" FOREIGN KEY ("retry_of") REFERENCES "public"."notification_deliveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ask_documents_feed_external_uq" ON "ask_documents" USING btree ("feed_id","external_id");--> statement-breakpoint
CREATE INDEX "ask_documents_review_status_idx" ON "ask_documents" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "notification_deliveries_retry_of_idx" ON "notification_deliveries" USING btree ("retry_of");