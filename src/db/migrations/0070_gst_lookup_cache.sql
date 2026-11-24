CREATE TABLE "gst_lookup_cache" (
	"gstin" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fetched_by" uuid
);
