CREATE TABLE "sharepoint_files_seen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"c_tag" text,
	"sha256" text NOT NULL,
	"path" text NOT NULL,
	"attachment_id" uuid,
	"read_key" text,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sharepoint_files_seen" ADD CONSTRAINT "sharepoint_files_seen_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sharepoint_files_seen_item" ON "sharepoint_files_seen" USING btree ("engagement_id","item_id");--> statement-breakpoint
CREATE INDEX "sharepoint_files_seen_sha" ON "sharepoint_files_seen" USING btree ("engagement_id","sha256");--> statement-breakpoint
CREATE INDEX "sharepoint_files_seen_attachment" ON "sharepoint_files_seen" USING btree ("attachment_id");