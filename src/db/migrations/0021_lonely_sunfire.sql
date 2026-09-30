CREATE TABLE "assist_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"text" text NOT NULL,
	"context_prefix" text,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(context_prefix, '') || ' ' || text)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assist_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"role" text NOT NULL,
	"shell" text NOT NULL,
	"engagement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assist_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"s3_key" text,
	"effective_from" date,
	"last_verified_at" timestamp with time zone,
	"owner_profile_id" uuid,
	"status" text DEFAULT 'processing' NOT NULL,
	"audience" text DEFAULT 'staff' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assist_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"text" text NOT NULL,
	"answer" jsonb,
	"origin" text,
	"guard" jsonb,
	"retrieved_chunk_ids" uuid[] DEFAULT '{}' NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_library_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"engagement_id" uuid NOT NULL,
	"topic_slug" text,
	"message_id" uuid,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"source_version" integer,
	"shared_with_team" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assist_chunks" ADD CONSTRAINT "assist_chunks_document_id_assist_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."assist_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_conversations" ADD CONSTRAINT "assist_conversations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_conversations" ADD CONSTRAINT "assist_conversations_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_documents" ADD CONSTRAINT "assist_documents_owner_profile_id_profiles_id_fk" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_messages" ADD CONSTRAINT "assist_messages_conversation_id_assist_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assist_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_library_items" ADD CONSTRAINT "client_library_items_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_library_items" ADD CONSTRAINT "client_library_items_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_library_items" ADD CONSTRAINT "client_library_items_message_id_assist_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."assist_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assist_chunks_document_ordinal_uq" ON "assist_chunks" USING btree ("document_id","ordinal");--> statement-breakpoint
CREATE INDEX "assist_chunks_tsv_idx" ON "assist_chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "assist_conversations_profile_idx" ON "assist_conversations" USING btree ("profile_id","last_message_at");--> statement-breakpoint
CREATE INDEX "assist_messages_conversation_idx" ON "assist_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "client_library_items_profile_idx" ON "client_library_items" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "client_library_items_profile_topic_uq" ON "client_library_items" USING btree ("profile_id","engagement_id","topic_slug") WHERE "client_library_items"."topic_slug" is not null;