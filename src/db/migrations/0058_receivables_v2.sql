CREATE TABLE "receivable_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"client_key" text NOT NULL,
	"gstin" text,
	"credit_days" integer DEFAULT 7 NOT NULL,
	"billing_email" text,
	"billing_cc" text[] DEFAULT '{}' NOT NULL,
	"partner_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivable_digest_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivable_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"partner_id" uuid,
	"client_id" uuid,
	"period_key" text,
	"dedupe_key" text,
	"recipient_name" text DEFAULT '' NOT NULL,
	"to" text[] DEFAULT '{}' NOT NULL,
	"cc" text[] DEFAULT '{}' NOT NULL,
	"subject" text NOT NULL,
	"html" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"sender_user_id" uuid,
	"invoice_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"error" text,
	"web_link" text,
	"whatsapp_status" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivable_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"period" text DEFAULT '' NOT NULL,
	"uploaded_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"changed_count" integer DEFAULT 0 NOT NULL,
	"same_count" integer DEFAULT 0 NOT NULL,
	"no_partner_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivable_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"sheet_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"invoice_id" uuid,
	"invoice_no" text,
	"invoice_key" text,
	"invoice_date" date,
	"client_name" text NOT NULL,
	"client_id" uuid,
	"partner_id" uuid,
	"gstin" text,
	"amount_inr" numeric(14, 2) NOT NULL,
	"old_amount_inr" numeric(14, 2),
	"due_date" date,
	"reason" text,
	"source" text NOT NULL,
	"requested_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receivable_invoices" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "receivable_invoices" ADD COLUMN "gstin" text;--> statement-breakpoint
ALTER TABLE "receivable_invoices" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_invoices" ADD COLUMN "tally_mismatch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_invoices" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_partners" ADD COLUMN "notify_new_invoice" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_partners" ADD COLUMN "notify_rollup" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "digest_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "digest_weekday" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "digest_hour_ist" integer DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "rollup_every_days" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "send_hour_ist" integer DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "email_new_invoice_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "email_rollup_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "email_revised_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_clients" ADD CONSTRAINT "receivable_clients_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_clients" ADD CONSTRAINT "receivable_clients_partner_id_receivable_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."receivable_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_digest_recipients" ADD CONSTRAINT "receivable_digest_recipients_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_email_log" ADD CONSTRAINT "receivable_email_log_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_email_log" ADD CONSTRAINT "receivable_email_log_partner_id_receivable_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."receivable_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_email_log" ADD CONSTRAINT "receivable_email_log_client_id_receivable_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."receivable_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_email_log" ADD CONSTRAINT "receivable_email_log_sender_user_id_profiles_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_import_batches" ADD CONSTRAINT "receivable_import_batches_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_import_batches" ADD CONSTRAINT "receivable_import_batches_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_import_rows" ADD CONSTRAINT "receivable_import_rows_batch_id_receivable_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."receivable_import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_import_rows" ADD CONSTRAINT "receivable_import_rows_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_import_rows" ADD CONSTRAINT "receivable_import_rows_invoice_id_receivable_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."receivable_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_import_rows" ADD CONSTRAINT "receivable_import_rows_client_id_receivable_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."receivable_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_import_rows" ADD CONSTRAINT "receivable_import_rows_partner_id_receivable_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."receivable_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_import_rows" ADD CONSTRAINT "receivable_import_rows_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_import_rows" ADD CONSTRAINT "receivable_import_rows_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "receivable_clients_sheet_key_idx" ON "receivable_clients" USING btree ("sheet_id","client_key");--> statement-breakpoint
CREATE INDEX "receivable_clients_partner_idx" ON "receivable_clients" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "receivable_digest_recipients_sheet_idx" ON "receivable_digest_recipients" USING btree ("sheet_id");--> statement-breakpoint
CREATE INDEX "receivable_email_log_sheet_idx" ON "receivable_email_log" USING btree ("sheet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "receivable_email_log_dedupe_idx" ON "receivable_email_log" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "receivable_import_batches_sheet_idx" ON "receivable_import_batches" USING btree ("sheet_id","status");--> statement-breakpoint
CREATE INDEX "receivable_import_rows_sheet_idx" ON "receivable_import_rows" USING btree ("sheet_id","status");--> statement-breakpoint
CREATE INDEX "receivable_import_rows_batch_idx" ON "receivable_import_rows" USING btree ("batch_id");--> statement-breakpoint
ALTER TABLE "receivable_invoices" ADD CONSTRAINT "receivable_invoices_client_id_receivable_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."receivable_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receivable_invoices_client_idx" ON "receivable_invoices" USING btree ("client_id");--> statement-breakpoint
-- Backfill (receivables v2): one client per distinct client name on each sheet, keyed the way
-- src/lib/receivables/client-key.ts keys it (lower case, every run of punctuation or spaces as one
-- space), taking the partner most of that client's invoices carry. Then each invoice is linked.
INSERT INTO "receivable_clients" ("sheet_id", "name", "client_key", "partner_id")
SELECT DISTINCT ON (i."sheet_id", trim(regexp_replace(lower(i."client_name"), '[^a-z0-9]+', ' ', 'g')))
  i."sheet_id",
  i."client_name",
  trim(regexp_replace(lower(i."client_name"), '[^a-z0-9]+', ' ', 'g')),
  (SELECT j."partner_id" FROM "receivable_invoices" j
    WHERE j."sheet_id" = i."sheet_id" AND j."deleted_at" IS NULL AND j."partner_id" IS NOT NULL
      AND trim(regexp_replace(lower(j."client_name"), '[^a-z0-9]+', ' ', 'g')) = trim(regexp_replace(lower(i."client_name"), '[^a-z0-9]+', ' ', 'g'))
    GROUP BY j."partner_id" ORDER BY count(*) DESC LIMIT 1)
FROM "receivable_invoices" i
WHERE i."deleted_at" IS NULL AND trim(regexp_replace(lower(i."client_name"), '[^a-z0-9]+', ' ', 'g')) <> ''
ORDER BY i."sheet_id", trim(regexp_replace(lower(i."client_name"), '[^a-z0-9]+', ' ', 'g')), i."created_at"
ON CONFLICT ("sheet_id", "client_key") DO NOTHING;
--> statement-breakpoint
UPDATE "receivable_invoices" i SET "client_id" = c."id"
FROM "receivable_clients" c
WHERE c."sheet_id" = i."sheet_id" AND i."client_id" IS NULL
  AND c."client_key" = trim(regexp_replace(lower(i."client_name"), '[^a-z0-9]+', ' ', 'g'));
