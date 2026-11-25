CREATE TABLE "tally_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"token_hash" text,
	"pairing_code_hash" text,
	"pairing_expires_at" timestamp with time zone,
	"tally_company" text,
	"version" text,
	"tally_reachable" boolean,
	"last_seen_at" timestamp with time zone,
	"paired_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tally_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"connector_id" uuid,
	"type" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"requested_by" uuid,
	"error" text,
	"stats" jsonb,
	"batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "receivable_import_batches" ADD COLUMN "source" text DEFAULT 'excel' NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_import_batches" ADD COLUMN "kind" text DEFAULT 'sales' NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_import_rows" ADD COLUMN "received_on" date;--> statement-breakpoint
ALTER TABLE "receivable_import_rows" ADD COLUMN "receipt_no" text;--> statement-breakpoint
ALTER TABLE "receivable_import_rows" ADD COLUMN "receipt_ref" text;--> statement-breakpoint
ALTER TABLE "tally_connectors" ADD CONSTRAINT "tally_connectors_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally_connectors" ADD CONSTRAINT "tally_connectors_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally_sync_jobs" ADD CONSTRAINT "tally_sync_jobs_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally_sync_jobs" ADD CONSTRAINT "tally_sync_jobs_connector_id_tally_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."tally_connectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally_sync_jobs" ADD CONSTRAINT "tally_sync_jobs_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tally_sync_jobs" ADD CONSTRAINT "tally_sync_jobs_batch_id_receivable_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."receivable_import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tally_connectors_token_hash_idx" ON "tally_connectors" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "tally_connectors_pairing_code_idx" ON "tally_connectors" USING btree ("pairing_code_hash");--> statement-breakpoint
CREATE INDEX "tally_connectors_sheet_idx" ON "tally_connectors" USING btree ("sheet_id");--> statement-breakpoint
CREATE INDEX "tally_sync_jobs_sheet_idx" ON "tally_sync_jobs" USING btree ("sheet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tally_sync_jobs_active_idx" ON "tally_sync_jobs" USING btree ("sheet_id") WHERE status in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "receivable_import_rows_receipt_ref_idx" ON "receivable_import_rows" USING btree ("sheet_id","receipt_ref");