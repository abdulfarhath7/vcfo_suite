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
ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_generated_by_profiles_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_sent_by_profiles_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_office_nocs" ADD CONSTRAINT "registered_office_nocs_signed_by_profiles_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;