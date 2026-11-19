CREATE TABLE "receivable_email_templates" (
	"sheet_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject" text,
	"greeting" text,
	"intro" text,
	"closing" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_email_templates_sheet_id_kind_pk" PRIMARY KEY("sheet_id","kind")
);
--> statement-breakpoint
ALTER TABLE "receivable_email_templates" ADD CONSTRAINT "receivable_email_templates_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_email_templates" ADD CONSTRAINT "receivable_email_templates_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;