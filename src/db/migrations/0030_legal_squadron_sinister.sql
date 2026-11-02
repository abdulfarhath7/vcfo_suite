CREATE TABLE "planner_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_by" uuid,
	"engagement_id" uuid,
	"item_ref" text,
	"title" text NOT NULL,
	"day" date NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planner_blocks" ADD CONSTRAINT "planner_blocks_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_blocks" ADD CONSTRAINT "planner_blocks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_blocks" ADD CONSTRAINT "planner_blocks_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planner_blocks_owner_day_idx" ON "planner_blocks" USING btree ("owner_id","day");