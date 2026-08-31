CREATE TYPE "public"."whatsapp_status" AS ENUM('unknown', 'verified', 'failed');--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid,
	"recipient_profile_id" uuid,
	"event_type" text NOT NULL,
	"channel" text NOT NULL,
	"to_address" text,
	"template_sid" text,
	"provider_message_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"skip_reason" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "phone_e164" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "whatsapp_opt_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "whatsapp_opt_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "whatsapp_status" "whatsapp_status" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipient_profile_id_profiles_id_fk" FOREIGN KEY ("recipient_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_deliveries_engagement_idx" ON "notification_deliveries" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_recipient_idx" ON "notification_deliveries" USING btree ("recipient_profile_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_provider_idx" ON "notification_deliveries" USING btree ("provider_message_id");