CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"scope" text DEFAULT 'firm' NOT NULL,
	"engagement_id" uuid,
	"accounts_server" text NOT NULL,
	"api_domain" text NOT NULL,
	"location" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"access_token_enc" text,
	"expires_at" timestamp with time zone,
	"scopes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_error" text,
	"connected_by" uuid,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"app" text NOT NULL,
	"external_type" text NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text NOT NULL,
	"external_org_id" text,
	"external_gstin" text,
	"external_pan" text,
	"vcfo_type" text,
	"vcfo_id" uuid,
	"vcfo_name" text,
	"match" text,
	"status" text DEFAULT 'unmapped' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"app" text NOT NULL,
	"external_org_id" text NOT NULL,
	"name" text NOT NULL,
	"gstin" text,
	"pan" text,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"field_check" jsonb,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"app" text NOT NULL,
	"module" text NOT NULL,
	"target_key" text DEFAULT '' NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "source" text DEFAULT 'excel' NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "zoho_app" text;--> statement-breakpoint
ALTER TABLE "receivable_sheets" ADD COLUMN "zoho_org_id" text;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_connected_by_profiles_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_links" ADD CONSTRAINT "integration_links_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_links" ADD CONSTRAINT "integration_links_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_orgs" ADD CONSTRAINT "integration_orgs_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_firm_active_idx" ON "integration_connections" USING btree ("provider") WHERE scope = 'firm' and revoked_at is null;--> statement-breakpoint
CREATE INDEX "integration_connections_engagement_idx" ON "integration_connections" USING btree ("engagement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_links_uq" ON "integration_links" USING btree ("connection_id","app","external_type","external_id");--> statement-breakpoint
CREATE INDEX "integration_links_vcfo_idx" ON "integration_links" USING btree ("vcfo_type","vcfo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_orgs_uq" ON "integration_orgs" USING btree ("connection_id","app","external_org_id");--> statement-breakpoint
CREATE INDEX "integration_sync_jobs_connection_idx" ON "integration_sync_jobs" USING btree ("connection_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_sync_jobs_active_idx" ON "integration_sync_jobs" USING btree ("connection_id","module","target_key") WHERE status in ('queued', 'running');