ALTER TABLE "compliance_instances" ADD COLUMN "window_from" date;--> statement-breakpoint
ALTER TABLE "compliance_instances" ADD COLUMN "window_to" date;--> statement-breakpoint
ALTER TABLE "compliance_instances" ADD COLUMN "window_set_by" uuid;--> statement-breakpoint
ALTER TABLE "compliance_instances" ADD COLUMN "window_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN "schedule" jsonb;