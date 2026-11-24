/**
 * GST Lookup cache: stores normalised GSTIN data for 24 hours to avoid
 * redundant external API calls. Re-exported from src/db/schema.ts.
 */
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const gstLookupCache = pgTable('gst_lookup_cache', {
  gstin: text('gstin').primaryKey(),
  data: jsonb('data').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  fetchedBy: uuid('fetched_by'),
});
