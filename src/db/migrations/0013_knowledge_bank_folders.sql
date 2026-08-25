-- Nested Knowledge Bank folders. Delete refuses non-empty folders:
-- ON DELETE restrict on parent_id (child folders) and on files.folder_id.
CREATE TABLE "knowledge_bank_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_bank_folders" ADD CONSTRAINT "knowledge_bank_folders_parent_id_knowledge_bank_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."knowledge_bank_folders"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_bank_folders" ADD CONSTRAINT "knowledge_bank_folders_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "knowledge_bank_folders_parent_idx" ON "knowledge_bank_folders" ("parent_id");
--> statement-breakpoint
ALTER TABLE "knowledge_bank_files" ADD COLUMN "folder_id" uuid;
--> statement-breakpoint
ALTER TABLE "knowledge_bank_files" ADD CONSTRAINT "knowledge_bank_files_folder_id_knowledge_bank_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."knowledge_bank_folders"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "knowledge_bank_files_folder_idx" ON "knowledge_bank_files" ("folder_id");
