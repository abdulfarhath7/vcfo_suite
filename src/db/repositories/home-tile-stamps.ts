import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { kpiSnapshots } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isAdminOrManager, isFirmWideAdmin } from '@/lib/auth';
import { istYmd, type HomeTrends } from '@/lib/metrics/home-trends';
import {
  STAMP_TILES,
  cleanStampValues,
  stampDays,
  stampKey,
  stampSeries,
  type StampHome,
} from '@/lib/metrics/home-tile-stamps';

/**
 * HOME TILE STAMPS REPOSITORY — the last value each staff home tile showed on each India day,
 * kept in `kpi_snapshots` (period = the day, key = `tile:<home>:<tile>`, scope = the person's
 * profile id). The pure rules are in `src/lib/metrics/home-tile-stamps.ts`.
 *
 * >>> ACCESS CONTROL <<<
 *   Each home has one role rule, the same as `home-trends.ts`: lead = project leads only,
 *   manager = managers and firm admins, admin = firm-wide admins only. A caller writes and
 *   reads only rows under their own profile id, so nobody can see or change another
 *   person's line. Only the keys listed in `STAMP_TILES` are written; the monthly Analytics
 *   keys in the same table are never touched.
 */

export class HomeTileStampError extends Error {
  readonly status = 403 as const;
}

function assertHome(ctx: AuthContext, home: StampHome): void {
  const ok =
    home === 'lead' ? ctx.role === 'intern'
    : home === 'manager' ? isAdminOrManager(ctx.role)
    : isFirmWideAdmin(ctx.role);
  if (!ok || !ctx.userId) throw new HomeTileStampError('This home is not yours');
}

/** Store today's tile values for the caller; a later call the same day overwrites them. */
export async function stampHomeTiles(
  ctx: AuthContext,
  home: StampHome,
  values: Record<string, unknown>,
  now: Date = new Date(),
): Promise<number> {
  assertHome(ctx, home);
  const clean = cleanStampValues(home, values);
  const period = istYmd(now);
  const rows = Object.entries(clean).map(([tile, v]) => ({
    period,
    key: stampKey(home, tile),
    scope: ctx.userId,
    value: String(v),
    takenAt: now,
  }));
  if (rows.length === 0) return 0;
  await db
    .insert(kpiSnapshots)
    .values(rows)
    .onConflictDoUpdate({
      target: [kpiSnapshots.period, kpiSnapshots.key, kpiSnapshots.scope],
      set: { value: sql`excluded.value`, takenAt: now },
    });
  return rows.length;
}

/** The caller's stamped series for one home, oldest first, without today. */
export async function getHomeTileTrends(ctx: AuthContext, home: StampHome, now: Date = new Date()): Promise<HomeTrends> {
  assertHome(ctx, home);
  const days = stampDays(istYmd(now));
  const keys = STAMP_TILES[home].map((tile) => stampKey(home, tile));
  const rows = await db
    .select({ period: kpiSnapshots.period, key: kpiSnapshots.key, value: kpiSnapshots.value })
    .from(kpiSnapshots)
    .where(and(eq(kpiSnapshots.scope, ctx.userId), inArray(kpiSnapshots.key, keys), inArray(kpiSnapshots.period, days)));
  return stampSeries(
    home,
    days,
    rows.map((r) => ({ period: String(r.period).slice(0, 10), key: r.key, value: Number(r.value) })),
  );
}
