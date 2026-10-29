/**
 * Client portal v7 — NEW tables for the team pages. Re-exported from
 * src/db/schema.ts so drizzle-kit and the repositories see one schema.
 *
 * Circular import note: this file is evaluated BEFORE schema.ts's body, so
 * `profiles` / `engagements` may only be touched lazily, inside
 * `.references(() => profiles.id)` callbacks — never at module top level.
 */
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, smallint } from 'drizzle-orm/pg-core';
import { engagements, profiles } from './schema';

/**
 * CLIENT INVITES (Team page): a colleague the Primary contact invited.
 *
 * Interim sign-in (owner decision): until the set-password link ships, the
 * invite creates the account with a one-off temporary password (emailed and
 * shown once in the Invite pop-up). `tempPasswordHash` is the bcrypt hash the
 * account was created with; while `profiles.password_hash` still equals it the
 * person has not chosen their own password yet, so the row shows "Invite sent".
 * Once it differs the invite counts as accepted (`acceptedAt` is stamped lazily).
 *
 * Access (repository `client-team.ts`): rows of the caller's own engagement only;
 * create / resend / cancel = that engagement's Primary contact (or staff with access).
 */
export const clientInvites = pgTable(
  'client_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name'),
    /** The client account the invite created or attached. */
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    invitedBy: uuid('invited_by').references(() => profiles.id, { onDelete: 'set null' }),
    /** Hash the account was created with (null = an existing account was attached). */
    tempPasswordHash: text('temp_password_hash'),
    /** SHA-256 of the set-password link token the invitee opens to choose a password (C-899); cleared once used. */
    setPasswordTokenHash: text('set_password_token_hash'),
    /** The set-password link stops working after this time (seven days after it was sent). */
    setPasswordExpiresAt: timestamp('set_password_expires_at', { withTimezone: true }),
    sendCount: integer('send_count').notNull().default(1),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('client_invites_engagement_idx').on(t.engagementId),
  }),
);

/**
 * NOTIFICATION PREFS (Settings › Notifications): per person, per category.
 *
 * Email is LOCKED ON for docs, steps, deadlines and timeline (owner decision);
 * only `announcements`, `feed` and `weeklyDigest` email can be switched off.
 * WhatsApp per category (no weekly digest on WhatsApp) + quiet hours.
 * Owner-only: every read and write keyed by `ctx.userId`.
 */
export const notificationPrefs = pgTable('notification_prefs', {
  profileId: uuid('profile_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  /** { announcements, feed, weeklyDigest } — the optional email categories. */
  email: jsonb('email').$type<Record<string, boolean>>().notNull().default({}),
  /** { docs, steps, deadlines, timeline, announcements, feed }. */
  whatsapp: jsonb('whatsapp').$type<Record<string, boolean>>().notNull().default({}),
  quietHours: boolean('quiet_hours').notNull().default(true),
  quietStart: text('quiet_start').notNull().default('21:00'),
  quietEnd: text('quiet_end').notNull().default('08:00'),
  tz: text('tz').notNull().default('Asia/Kolkata'),
  /** Days before a due date to send the reminder: 7, 3 or 1; null means the firm default (C-831). */
  remindDays: smallint('remind_days'),
  /** Local time for the daily digest email, "HH:MM"; null means no digest (P-626, S-656). */
  digestTime: text('digest_time'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * CLIENT ACCOUNT META (Settings › Security): when the person last changed their
 * password (the "changed 2 Sep" caption). Owner-only, keyed by `ctx.userId`.
 */
export const clientAccountMeta = pgTable('client_account_meta', {
  profileId: uuid('profile_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
