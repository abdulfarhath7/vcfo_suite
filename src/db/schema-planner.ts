/**
 * Staff console planner (portal redesign, Oct 2026) — NEW table for the work
 * blocks people lay on their week calendar (My work, Project leads, a lead's
 * Tasks page). Re-exported from src/db/schema.ts so drizzle-kit and the
 * repositories see one schema. Additive only: nothing else reads or writes it.
 *
 * Circular import note: this file is evaluated BEFORE schema.ts's body, so
 * `profiles` / `engagements` may only be touched lazily, inside
 * `.references(() => profiles.id)` callbacks — never at module top level.
 */
import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { engagements, profiles } from './schema';

/**
 * PLANNER BLOCKS — one work session on someone's calendar ("FC-GPR review,
 * Fri 30 Oct, 2:30 to 4:00 pm").
 *
 *   owner_id    whose calendar the block sits on (a manager plans their own
 *               week and their leads'; a lead plans their own)
 *   created_by  who put it there (null once that account is deleted)
 *   engagement  the client it is for (optional; cascade with the client)
 *   item_ref    the planner item it is for: 'step:<engagement>:<step>',
 *               'filing:<id>', 'request:<id>', 'task:<id>' or 'todo:<id>'
 *   day         the calendar day (IST civil date)
 *   start_min / end_min  minutes after midnight (540 = 9:00 am, 1140 = 7:00 pm)
 *
 * Access (repository `planner-blocks.ts`, Path A): a lead reads and writes
 * their own blocks; a manager their own and their leads' (leads who report to
 * them or lead a client in their book); admin and super admin everyone;
 * clients nothing.
 */
export const plannerBlocks = pgTable(
  'planner_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    engagementId: uuid('engagement_id').references(() => engagements.id, { onDelete: 'cascade' }),
    itemRef: text('item_ref'),
    title: text('title').notNull(),
    day: date('day').notNull(),
    startMin: integer('start_min').notNull(),
    endMin: integer('end_min').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerDayIdx: index('planner_blocks_owner_day_idx').on(t.ownerId, t.day),
  }),
);
