/**
 * Client portal v7 — NEW tables for the credentials pages. Re-exported from
 * src/db/schema.ts so drizzle-kit and the repositories see one schema.
 *
 * Circular import note: this file is evaluated BEFORE schema.ts's body, so
 * `profiles` / `engagements` may only be touched lazily, inside
 * `.references(() => profiles.id)` callbacks — never at module top level.
 *
 * Access (repository `src/db/repositories/credentials/`, Path A):
 *   client — its own engagement only; secret values only inside a live grant
 *            (manager-approved OTP, 10 minutes).
 *   staff  — the engagement's manager(s) / lead(s) (and firm admins) read and
 *            write directly; they are the people who approve the OTPs.
 */
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { engagements, profiles } from './schema';

/**
 * CREDENTIALS WORKBOOK — one row per sheet row the client or SBC has touched.
 * Template rows (the owner's fixed Login / Registrations / Address lists) and
 * auto-filled values (checklist responses) are computed at read time; this
 * table stores only what people typed (overrides, custom rows, statuses).
 *
 * `sheet`: 'address' | 'login' | 'reg' | 'kyc' | 'other'
 * `rowKey`: template key ('login:pan', 'reg:gst', 'address:registered'),
 *           a director ('director:pre15:<entryId>' / 'director:custom:<uuid>')
 *           or a custom row ('custom:<uuid>').
 * `fields`: non-secret cells by column key (plain text).
 * `secretCiphertext`: AES-256-GCM of JSON {colKey: value} for the secret
 *           columns (ID, password, mobile, DOB, PAN, Aadhaar…), key from env
 *           CREDENTIALS_ENCRYPTION_KEY (`src/lib/credentials-crypto.ts`).
 *           Never returned by a list read.
 * `edited`: {colKey: true} when a value that came from a checklist step was
 *           changed by hand (the "Edited" chip; the auto value is ignored).
 */
export const engagementCredentials = pgTable(
  'engagement_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    sheet: text('sheet').notNull(),
    rowKey: text('row_key').notNull(),
    ordinal: integer('ordinal').notNull().default(0),
    fields: jsonb('fields').$type<Record<string, string>>().notNull().default({}),
    secretCiphertext: text('secret_ciphertext'),
    edited: jsonb('edited').$type<Record<string, boolean>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
  },
  (t) => ({
    rowUq: uniqueIndex('engagement_credentials_row_uq').on(t.engagementId, t.sheet, t.rowKey),
    engIdx: index('engagement_credentials_engagement_idx').on(t.engagementId),
  }),
);

/**
 * ONE-TIME CODES for Preview / Edit / Reveal. The code goes to the
 * engagement's Project Manager(s), never to the client. Only an HMAC of the
 * code is stored. 3 wrong codes lock the OTP for 60 s; resend every 30 s.
 */
export const credentialOtps = pgTable(
  'credential_otps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    /** Manager the code was sent to (first of several when co-managers exist). */
    approverProfileId: uuid('approver_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    approverName: text('approver_name'),
    mode: text('mode').notNull(), // preview | edit | reveal
    scope: text('scope').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    resendAvailableAt: timestamp('resend_available_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reqIdx: index('credential_otps_requester_idx').on(t.requestedBy, t.engagementId),
  }),
);

/** A live Preview / Edit / Reveal window (10 minutes) for one scope. */
export const credentialAccessGrants = pgTable(
  'credential_access_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(), // preview | edit | reveal
    /** 'page' | 'tab:<sheet>' | 'row:<sheet>|<rowKey>' | 'cell:<sheet>|<rowKey>|<colKey>' */
    scope: text('scope').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    approvedBy: uuid('approved_by').references(() => profiles.id, { onDelete: 'set null' }),
    otpId: uuid('otp_id'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    liveIdx: index('credential_access_grants_live_idx').on(t.profileId, t.engagementId, t.expiresAt),
  }),
);

/**
 * PAN / TAN password reveal (Home › Company IDs): failed password attempts per
 * person. 3 wrong → locked 60 s (mirrors the credentials OTP lock).
 */
export const identifierRevealAttempts = pgTable('identifier_reveal_attempts', {
  profileId: uuid('profile_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  failures: integer('failures').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
