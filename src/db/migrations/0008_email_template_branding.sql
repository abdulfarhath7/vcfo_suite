ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "branding" text DEFAULT 'sbc' NOT NULL;
