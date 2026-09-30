-- Rename the in-app assistant tables to the Ask VCFO namespace (ASK-VCFO-CONTEXT.md).
-- "VCFO Assist" is a separate product (the MCA portal extension); these tables were
-- created in 0021 under the old working name. Renames keep all rows.
ALTER TABLE "assist_conversations" RENAME TO "ask_conversations";--> statement-breakpoint
ALTER TABLE "assist_messages" RENAME TO "ask_messages";--> statement-breakpoint
ALTER TABLE "assist_documents" RENAME TO "ask_documents";--> statement-breakpoint
ALTER TABLE "assist_chunks" RENAME TO "ask_chunks";--> statement-breakpoint
ALTER INDEX "assist_conversations_profile_idx" RENAME TO "ask_conversations_profile_idx";--> statement-breakpoint
ALTER INDEX "assist_messages_conversation_idx" RENAME TO "ask_messages_conversation_idx";--> statement-breakpoint
ALTER INDEX "assist_chunks_document_ordinal_uq" RENAME TO "ask_chunks_document_ordinal_uq";--> statement-breakpoint
ALTER INDEX "assist_chunks_tsv_idx" RENAME TO "ask_chunks_tsv_idx";--> statement-breakpoint
ALTER TABLE "ask_conversations" RENAME CONSTRAINT "assist_conversations_profile_id_profiles_id_fk" TO "ask_conversations_profile_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "ask_conversations" RENAME CONSTRAINT "assist_conversations_engagement_id_engagements_id_fk" TO "ask_conversations_engagement_id_engagements_id_fk";--> statement-breakpoint
ALTER TABLE "ask_conversations" RENAME CONSTRAINT "assist_conversations_pkey" TO "ask_conversations_pkey";--> statement-breakpoint
ALTER TABLE "ask_messages" RENAME CONSTRAINT "assist_messages_conversation_id_assist_conversations_id_fk" TO "ask_messages_conversation_id_ask_conversations_id_fk";--> statement-breakpoint
ALTER TABLE "ask_messages" RENAME CONSTRAINT "assist_messages_pkey" TO "ask_messages_pkey";--> statement-breakpoint
ALTER TABLE "ask_documents" RENAME CONSTRAINT "assist_documents_owner_profile_id_profiles_id_fk" TO "ask_documents_owner_profile_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "ask_documents" RENAME CONSTRAINT "assist_documents_pkey" TO "ask_documents_pkey";--> statement-breakpoint
ALTER TABLE "ask_chunks" RENAME CONSTRAINT "assist_chunks_document_id_assist_documents_id_fk" TO "ask_chunks_document_id_ask_documents_id_fk";--> statement-breakpoint
ALTER TABLE "ask_chunks" RENAME CONSTRAINT "assist_chunks_pkey" TO "ask_chunks_pkey";--> statement-breakpoint
ALTER TABLE "client_library_items" RENAME CONSTRAINT "client_library_items_message_id_assist_messages_id_fk" TO "client_library_items_message_id_ask_messages_id_fk";
