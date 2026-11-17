CREATE TABLE "receivable_client_partners" (
	"sheet_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_client_partners_client_id_partner_id_pk" PRIMARY KEY("client_id","partner_id")
);
--> statement-breakpoint
ALTER TABLE "receivable_client_partners" ADD CONSTRAINT "receivable_client_partners_sheet_id_receivable_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."receivable_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_client_partners" ADD CONSTRAINT "receivable_client_partners_client_id_receivable_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."receivable_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_client_partners" ADD CONSTRAINT "receivable_client_partners_partner_id_receivable_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."receivable_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receivable_client_partners_sheet_idx" ON "receivable_client_partners" USING btree ("sheet_id");