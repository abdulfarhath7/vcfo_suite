/**
 * DIN lookup (docs/context/notes/mca-lookup.md).
 *
 * `din_lookup_cache` holds the normalised MCA director record for 24 hours, whichever source
 * it came from: the FalconeBiz API, or the MCA portal read inside a person's own logged-in
 * session by the VCFO Assist extension.
 *
 * `mca_din_requests` is the queue between the two tabs. A staff member asks for a DIN in the
 * Suite, the extension picks the request up from the same person's session, reads the portal
 * page and posts the record back. Re-exported from src/db/schema.ts.
 */
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const dinLookupCache = pgTable('din_lookup_cache', {
  din: text('din').primaryKey(),
  data: jsonb('data').notNull(),
  /** 'falcon' (the API) or 'mca-portal' (read in a person's own session). */
  source: text('source').notNull().default('falcon'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  fetchedBy: uuid('fetched_by'),
});

export const mcaDinRequests = pgTable(
  'mca_din_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    din: text('din').notNull(),
    /** requested → running → done | failed | cancelled. */
    state: text('state').notNull().default('requested'),
    requestedBy: uuid('requested_by').notNull(),
    /** Why the read stopped: the person is signed out, the portal changed, and so on. */
    error: text('error'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('mca_din_requests_by_person').on(t.requestedBy, t.state)],
);
