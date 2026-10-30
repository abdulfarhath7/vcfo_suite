CREATE TABLE "engagement_board_resolution_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"variant" text NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "notarised_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "notarised_by" uuid;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "apostilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "apostilled_by" uuid;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "accepted_by" uuid;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "sent_back_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "sent_back_by" uuid;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "sent_back_reason" text;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "receive_checks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "notary_steps_off" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "template_variant" text;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "template_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "template_changed_by" uuid;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "template_change_reason" text;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD COLUMN "vault_document_id" uuid;--> statement-breakpoint
ALTER TABLE "engagement_board_resolution_versions" ADD CONSTRAINT "engagement_board_resolution_versions_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_board_resolution_versions" ADD CONSTRAINT "engagement_board_resolution_versions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "engagement_br_versions_unique" ON "engagement_board_resolution_versions" USING btree ("engagement_id","version");--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD CONSTRAINT "engagement_board_resolutions_notarised_by_profiles_id_fk" FOREIGN KEY ("notarised_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD CONSTRAINT "engagement_board_resolutions_apostilled_by_profiles_id_fk" FOREIGN KEY ("apostilled_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD CONSTRAINT "engagement_board_resolutions_accepted_by_profiles_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD CONSTRAINT "engagement_board_resolutions_sent_back_by_profiles_id_fk" FOREIGN KEY ("sent_back_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_board_resolutions" ADD CONSTRAINT "engagement_board_resolutions_template_changed_by_profiles_id_fk" FOREIGN KEY ("template_changed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill (BR-NOC-API.md): a signed copy that was Received (pre-3 accepted) before this build reads as Accepted. Writes only the new columns.
UPDATE "engagement_board_resolutions" br
SET "accepted_at" = COALESCE(
      CASE WHEN (e."checklist_state"->'pre-3'->>'reviewedAt') ~ '^\d{4}-\d{2}-\d{2}'
           THEN (e."checklist_state"->'pre-3'->>'reviewedAt')::timestamptz END,
      br."signed_uploaded_at",
      now()),
    "accepted_by" = (SELECT p."id" FROM "profiles" p WHERE p."id"::text = e."checklist_state"->'pre-3'->>'reviewedBy')
FROM "engagements" e
WHERE e."id" = br."engagement_id"
  AND br."accepted_at" IS NULL
  AND br."signed_storage_path" IS NOT NULL
  AND e."checklist_state"->'pre-3'->>'reviewStatus' = 'accepted';
