CREATE TABLE "receivable_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"client" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '' NOT NULL,
	"eta" text DEFAULT '' NOT NULL,
	"amount_inr" numeric(14, 2),
	"due" text DEFAULT '' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receivable_deposits" ADD CONSTRAINT "receivable_deposits_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_deposits" ADD CONSTRAINT "receivable_deposits_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receivable_deposits_sheet_idx" ON "receivable_deposits" USING btree ("sheet_id","position");