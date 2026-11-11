import 'server-only';

import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { statutoryCalendars, statutoryDeadlines } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import {
  BUILT_IN_FY_KEY,
  STATUTORY_DEADLINES,
  type StatutoryAct,
  type StatutoryDeadline,
} from '@/data/statutory-calendar-fy2627';
import { canImportStatutoryCalendar } from '@/lib/statutory-calendar/access';
import { fyBounds, type FyBounds } from '@/lib/statutory-calendar/fy';
import type { ImportedDeadline } from '@/lib/statutory-calendar/parse';
import type {
  StatutoryCalendarImport,
  StatutoryCalendarSource,
  StatutoryCalendarView,
  StatutoryCalendarYear,
} from '@/lib/statutory-calendar/types';

/**
 * STATUTORY CALENDAR — the all-India compliance deadlines, one calendar per financial year.
 *
 * Every signed-in role reads it: it is public reference data with no client in it, and leads and
 * managers narrow it to their own companies in the view. Only the admin writes it, by importing
 * the Excel template; an import replaces the whole year. FY 2026-27 serves the built-in calendar
 * until an admin imports that year.
 */

export type { StatutoryCalendarImport, StatutoryCalendarSource, StatutoryCalendarView, StatutoryCalendarYear };

type CalendarRow = typeof statutoryCalendars.$inferSelect;
type DeadlineRow = typeof statutoryDeadlines.$inferSelect;

function assertCanImport(ctx: AuthContext) {
  if (!canImportStatutoryCalendar(ctx.role)) throw new Error('not permitted');
}

function mapDeadline(row: DeadlineRow): StatutoryDeadline {
  return {
    id: `sd-${row.dueDate}-${row.position}`,
    date: row.dueDate,
    act: row.act as StatutoryAct,
    title: row.title,
    ...(row.appliesTo === 'co' || row.appliesTo === 'llp' ? { scope: row.appliesTo } : {}),
    ...(row.actLabel ? { actLabel: row.actLabel } : {}),
    ...(row.note ? { note: row.note } : {}),
  };
}

function mapImport(row: CalendarRow): StatutoryCalendarImport {
  return {
    fileName: row.fileName,
    importedAt: row.importedAt.toISOString(),
    importedByName: row.importedByName,
    rowCount: row.rowCount,
  };
}

async function readCalendar(fyKey: string): Promise<StatutoryCalendarView> {
  const fy = fyBounds(fyKey);
  const [calendar] = await db.select().from(statutoryCalendars).where(eq(statutoryCalendars.fy, fy.key)).limit(1);
  if (calendar) {
    const rows = await db
      .select()
      .from(statutoryDeadlines)
      .where(eq(statutoryDeadlines.fy, fy.key))
      .orderBy(asc(statutoryDeadlines.position));
    return { fy, source: 'imported', deadlines: rows.map(mapDeadline), imported: mapImport(calendar) };
  }
  if (fy.key === BUILT_IN_FY_KEY) {
    return { fy, source: 'built-in', deadlines: STATUTORY_DEADLINES, imported: null };
  }
  return { fy, source: 'none', deadlines: [], imported: null };
}

/** The calendar for one financial year ("2027-28"). Every role may read it. */
export async function getStatutoryCalendar(_ctx: AuthContext, fyKey: string): Promise<StatutoryCalendarView> {
  return readCalendar(fyKey);
}

/** Every year that has a calendar, newest first, with the built-in year when it was not imported. */
export async function listStatutoryCalendarYears(_ctx: AuthContext): Promise<StatutoryCalendarYear[]> {
  return systemListStatutoryCalendarYears();
}

/**
 * Replaces the whole calendar for `fyKey` with `deadlines`, in one transaction, so readers see the
 * old year or the new one and never half of each. Admin only.
 */
export async function replaceStatutoryCalendar(
  ctx: AuthContext,
  fyKey: string,
  deadlines: readonly ImportedDeadline[],
  meta: { fileName: string | null },
): Promise<{ fy: FyBounds; rowCount: number; replacedRowCount: number | null }> {
  assertCanImport(ctx);
  const fy = fyBounds(fyKey);
  if (deadlines.length === 0) throw new Error('invalid_body');
  for (const d of deadlines) {
    if (d.date < fy.start || d.date > fy.end) throw new Error('invalid_body');
  }

  return db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ rowCount: statutoryCalendars.rowCount })
      .from(statutoryCalendars)
      .where(eq(statutoryCalendars.fy, fy.key))
      .limit(1);
    // Deleting the calendar row cascades to its deadlines.
    await tx.delete(statutoryCalendars).where(eq(statutoryCalendars.fy, fy.key));
    await tx.insert(statutoryCalendars).values({
      fy: fy.key,
      fileName: meta.fileName,
      rowCount: deadlines.length,
      importedBy: ctx.userId,
      importedByName: ctx.name,
    });
    const rows = deadlines.map((d, position) => ({
      fy: fy.key,
      position,
      dueDate: d.date,
      act: d.act,
      actLabel: d.actLabel ?? null,
      title: d.title,
      appliesTo: d.scope ?? null,
      note: d.note ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(statutoryDeadlines).values(rows.slice(i, i + 500));
    }
    return { fy, rowCount: deadlines.length, replacedRowCount: previous?.rowCount ?? null };
  });
}

/** Job and script use (no session): the calendar for one year, as every role sees it. */
export async function systemGetStatutoryCalendar(fyKey: string): Promise<StatutoryCalendarView> {
  return readCalendar(fyKey);
}

/** Job and script use (no session): every year that has a calendar, newest first. */
export async function systemListStatutoryCalendarYears(): Promise<StatutoryCalendarYear[]> {
  const rows = await db
    .select({ fy: statutoryCalendars.fy, rowCount: statutoryCalendars.rowCount })
    .from(statutoryCalendars)
    .orderBy(desc(statutoryCalendars.fy));
  const years: StatutoryCalendarYear[] = rows.map((r) => ({ fy: r.fy, source: 'imported', rowCount: r.rowCount }));
  if (!years.some((y) => y.fy === BUILT_IN_FY_KEY)) {
    years.push({ fy: BUILT_IN_FY_KEY, source: 'built-in', rowCount: STATUTORY_DEADLINES.length });
  }
  return years.sort((a, b) => b.fy.localeCompare(a.fy));
}
