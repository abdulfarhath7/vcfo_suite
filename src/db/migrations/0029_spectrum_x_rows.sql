CREATE TABLE "assist_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_key" text NOT NULL,
	"form" text,
	"state" text DEFAULT 'requested' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reference" text,
	"fields_written" integer,
	"mismatches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"idempotency_key" text,
	"versions" text,
	"started_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "compliance_subject_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_key" text NOT NULL,
	"field_key" text NOT NULL,
	"side" text NOT NULL,
	"value" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dev_api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dev_deploy_images" (
	"image" text PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dev_service_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" text NOT NULL,
	"ok" boolean NOT NULL,
	"latency_ms" integer NOT NULL,
	"detail" text,
	"checked_by" uuid,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dev_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_in_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "whatsapp_verify_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "link_path" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "replaced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "replaced_by_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "document_request_details" ADD COLUMN "subject_kind" text;--> statement-breakpoint
ALTER TABLE "document_request_details" ADD COLUMN "subject_key" text;--> statement-breakpoint
ALTER TABLE "client_invites" ADD COLUMN "set_password_token_hash" text;--> statement-breakpoint
ALTER TABLE "client_invites" ADD COLUMN "set_password_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "service_targets" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "firm_settings" ADD COLUMN "role_permissions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "assist_runs" ADD CONSTRAINT "assist_runs_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_runs" ADD CONSTRAINT "assist_runs_started_by_profiles_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_subject_fields" ADD CONSTRAINT "compliance_subject_fields_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_subject_fields" ADD CONSTRAINT "compliance_subject_fields_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_subject_fields" ADD CONSTRAINT "compliance_subject_fields_confirmed_by_profiles_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_api_tokens" ADD CONSTRAINT "dev_api_tokens_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_service_checks" ADD CONSTRAINT "dev_service_checks_checked_by_profiles_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_settings" ADD CONSTRAINT "dev_settings_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_in_links" ADD CONSTRAINT "sign_in_links_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_verify_codes" ADD CONSTRAINT "whatsapp_verify_codes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assist_runs_subject_idx" ON "assist_runs" USING btree ("engagement_id","subject_kind","subject_key","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assist_runs_idempotency_idx" ON "assist_runs" USING btree ("engagement_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_subject_fields_uq" ON "compliance_subject_fields" USING btree ("engagement_id","subject_kind","subject_key","field_key");--> statement-breakpoint
CREATE UNIQUE INDEX "dev_api_tokens_hash_uq" ON "dev_api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "dev_service_checks_service_at_idx" ON "dev_service_checks" USING btree ("service","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sign_in_links_provider_subject_uidx" ON "sign_in_links" USING btree ("provider","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "sign_in_links_profile_provider_uidx" ON "sign_in_links" USING btree ("profile_id","provider");--> statement-breakpoint
CREATE INDEX "whatsapp_verify_codes_user_idx" ON "whatsapp_verify_codes" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deleted_by_profiles_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_request_details_subject_idx" ON "document_request_details" USING btree ("engagement_id","subject_kind","subject_key");