CREATE TABLE "statutory_calendars" (
	"fy" text PRIMARY KEY NOT NULL,
	"file_name" text,
	"row_count" integer NOT NULL,
	"imported_by" uuid,
	"imported_by_name" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statutory_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fy" text NOT NULL,
	"position" integer NOT NULL,
	"due_date" date NOT NULL,
	"act" text NOT NULL,
	"act_label" text,
	"title" text NOT NULL,
	"applies_to" text,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "statutory_calendars" ADD CONSTRAINT "statutory_calendars_imported_by_profiles_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statutory_deadlines" ADD CONSTRAINT "statutory_deadlines_fy_statutory_calendars_fy_fk" FOREIGN KEY ("fy") REFERENCES "public"."statutory_calendars"("fy") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "statutory_deadlines_fy_date_idx" ON "statutory_deadlines" USING btree ("fy","due_date");