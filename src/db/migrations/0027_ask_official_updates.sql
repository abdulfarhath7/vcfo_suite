ALTER TABLE "ask_documents" ADD COLUMN "feed_id" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "published_at" date;--> statement-breakpoint
ALTER TABLE "ask_documents" ADD COLUMN "summary" text;--> statement-breakpoint
CREATE UNIQUE INDEX "ask_documents_feed_external_uq" ON "ask_documents" USING btree ("feed_id","external_id");