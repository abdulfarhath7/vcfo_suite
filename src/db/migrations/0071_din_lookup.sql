CREATE TABLE "din_lookup_cache" (
	"din" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"source" text DEFAULT 'falcon' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fetched_by" uuid
);
--> statement-breakpoint
CREATE TABLE "mca_din_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"din" text NOT NULL,
	"state" text DEFAULT 'requested' NOT NULL,
	"requested_by" uuid NOT NULL,
	"error" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mca_din_requests_by_person" ON "mca_din_requests" USING btree ("requested_by","state");