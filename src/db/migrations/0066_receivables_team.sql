ALTER TABLE "receivable_sheet_editors" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "receivable_sheet_editors" ADD COLUMN "whatsapp_updates" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheet_editors" ADD COLUMN "can_approve" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheet_editors" ADD COLUMN "set_password_token_hash" text;--> statement-breakpoint
ALTER TABLE "receivable_sheet_editors" ADD COLUMN "set_password_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "receivable_sheet_editors_token_idx" ON "receivable_sheet_editors" USING btree ("set_password_token_hash");