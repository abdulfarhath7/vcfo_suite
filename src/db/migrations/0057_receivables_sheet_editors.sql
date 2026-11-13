CREATE TABLE "receivable_sheet_editors" (
	"sheet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_sheet_editors_sheet_id_user_id_pk" PRIMARY KEY("sheet_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "receivable_sheet_editors" ADD CONSTRAINT "receivable_sheet_editors_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_sheet_editors" ADD CONSTRAINT "receivable_sheet_editors_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_sheet_editors" ADD CONSTRAINT "receivable_sheet_editors_added_by_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receivable_sheet_editors_user_idx" ON "receivable_sheet_editors" USING btree ("user_id");