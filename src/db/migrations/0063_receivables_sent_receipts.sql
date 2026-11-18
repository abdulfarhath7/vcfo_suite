CREATE TABLE "receivable_sent_receipts" (
	"sheet_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"email" text NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_sent_receipts_invoice_id_email_pk" PRIMARY KEY("invoice_id","email")
);
--> statement-breakpoint
ALTER TABLE "receivable_sent_receipts" ADD CONSTRAINT "receivable_sent_receipts_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_sent_receipts" ADD CONSTRAINT "receivable_sent_receipts_invoice_id_receivable_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."receivable_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receivable_sent_receipts_sheet_idx" ON "receivable_sent_receipts" USING btree ("sheet_id");