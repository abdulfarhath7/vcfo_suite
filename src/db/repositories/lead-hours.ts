import 'server-only';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, timeBlocks } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { istWeekBounds, sumBlockHours } from '@/lib/metrics/lead-hours';

/**
 * LEAD HOURS REPOSITORY — hours each project lead planned this week (Analytics Workload, F-163).
 *
 * The hours are the lead's own planner blocks (`time_blocks`) that start inside the India week
 * (Monday 00:00 to the next Monday 00:00), summed per person; a block that runs past the week
 * end counts only up to it.
 *
 * >>> ACCESS CONTROL <<<
 *   Firm-wide admins see every active project lead. A manager sees only the leads who report to
 *   them (`reports_to_manager_id`). Project leads, clients and developers get nothing: the
 *   Analytics workload card is a manager view. Only the sums leave the server, never the
 *   block titles.
 */

export interface LeadHours {
  profileId: string;
  /** The lead's intern id, the key the Analytics workload rows use. */
  internId: string | null;
  name: string;
  /** Hours planned this week, one decimal. */
  hours: number;
}

export async function getLeadHoursThisWeek(ctx: AuthContext, now: Date = new Date()): Promise<{ weekStart: string; leads: LeadHours[] }> {
  const { start, end, weekStart } = istWeekBounds(now);
  if (!isFirmWideAdmin(ctx.role) && ctx.role !== 'manager') return { weekStart, leads: [] };

  const leadWhere = isFirmWideAdmin(ctx.role)
    ? and(eq(profiles.role, 'intern'), eq(profiles.status, 'active'))
    : and(eq(profiles.role, 'intern'), eq(profiles.status, 'active'), eq(profiles.reportsToManagerId, ctx.userId));
  const people = await db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email, internId: profiles.internId })
    .from(profiles)
    .where(leadWhere);
  if (people.length === 0) return { weekStart, leads: [] };

  const blocks = await db
    .select({ userId: timeBlocks.userId, startsAt: timeBlocks.startsAt, endsAt: timeBlocks.endsAt })
    .from(timeBlocks)
    .where(and(inArray(timeBlocks.userId, people.map((p) => p.id)), gte(timeBlocks.startsAt, start), lt(timeBlocks.startsAt, end)));
  const hours = sumBlockHours(blocks, end);

  return {
    weekStart,
    leads: people.map((p) => ({
      profileId: p.id,
      internId: p.internId?.trim() || null,
      name: p.name?.trim() || p.email,
      hours: hours.get(p.id) ?? 0,
    })),
  };
}
