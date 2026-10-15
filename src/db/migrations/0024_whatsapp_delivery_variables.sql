ALTER TABLE "notification_deliveries" ADD COLUMN "variables" jsonb;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "retry_of" uuid;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_retry_of_notification_deliveries_id_fk" FOREIGN KEY ("retry_of") REFERENCES "public"."notification_deliveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_deliveries_retry_of_idx" ON "notification_deliveries" USING btree ("retry_of");