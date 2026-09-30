CREATE TABLE "ask_client_prefs" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"last_nudge_at" timestamp with time zone,
	"dismissed_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ask_client_prefs" ADD CONSTRAINT "ask_client_prefs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;