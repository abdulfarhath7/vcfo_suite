-- WARNING: this migration cannot be undone. It drops the bank_credits table (the HSBC bank feed,
-- removed in receivables v2, docs/specs/receivables/V2.md) and every row in it. Take an RDS
-- snapshot first. receivable_firas.bank_credit_id stays as a plain column (history only).
ALTER TABLE "receivable_firas" DROP CONSTRAINT IF EXISTS "receivable_firas_bank_credit_id_bank_credits_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "bank_credits" CASCADE;
