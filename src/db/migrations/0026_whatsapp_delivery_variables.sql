-- WhatsApp send log: template variables + retry chain (idempotent: the local
-- dev database received these columns under the old 0024 number before the
-- client-portal v7 migrations took 0024/0025).
ALTER TABLE "notification_deliveries" ADD COLUMN IF NOT EXISTS "variables" jsonb;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN IF NOT EXISTS "retry_of" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_deliveries_retry_of_notification_deliveries_id_fk'
  ) THEN
    ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_retry_of_notification_deliveries_id_fk" FOREIGN KEY ("retry_of") REFERENCES "public"."notification_deliveries"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_deliveries_retry_of_idx" ON "notification_deliveries" USING btree ("retry_of");
