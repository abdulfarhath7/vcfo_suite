CREATE TABLE "announcement_reads" (
	"profile_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reads_profile_id_announcement_id_pk" PRIMARY KEY("profile_id","announcement_id")
);
--> statement-breakpoint
CREATE TABLE "client_portal_prefs" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"view_state" text DEFAULT 'auto' NOT NULL,
	"theme" text DEFAULT 'light' NOT NULL,
	"nav_open" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"intro_seen_at" timestamp with time zone,
	"doc_grouping" text DEFAULT 'step' NOT NULL,
	"bot_note_seen_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_prefs" ADD CONSTRAINT "client_portal_prefs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;