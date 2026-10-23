ALTER TABLE "ask_documents" ADD COLUMN "review_status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "review_pdf_key" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD CONSTRAINT "ask_documents_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_documents_review_status_idx" ON "ask_documents" USING btree ("review_status");