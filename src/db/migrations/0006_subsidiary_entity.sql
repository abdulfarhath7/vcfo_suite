ALTER TABLE "engagements" ADD COLUMN IF NOT EXISTS "subsidiary_legal_name" text;--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN IF NOT EXISTS "subsidiary_registered_address" text;
