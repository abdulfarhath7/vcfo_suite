import { addDaysYmd, TREND_POINTS, trailingKnown, type HomeTrends } from '@/lib/metrics/home-trends';

/**
 * HOME TILE STAMPS — the trend lines of staff home tiles whose past cannot be rebuilt from
 * stored rows (F-071, F-072).
 *
 * Tiles such as the lead's Needs action or the admin's Stuck mix step windows, filing windows
 * and request states that keep no history. Instead of guessing, the home stores the number the
 * tile showed: each time a person opens their home, the screen sends the live tile values and
 * the server keeps the last value of that India day (`kpi_snapshots`, one row per day, tile and
 * person). The line is then the stamped days before today, oldest first, with the live value
 * appended by the screen. A day nobody opened the home is a gap, and the line starts after the
 * last gap (`trailingKnown`), so it never joins two days across a missing one.
 */

/** The tiles each home may stamp. Anything else is refused. */
export const STAMP_TILES = {
  lead: ['needsAction', 'overdue', 'waitingClients', 'dueWeek'],
  manager: ['activeProjects', 'overdue', 'waitingClients', 'dueWeek'],
  admin: ['clients', 'incorporating', 'inCompliance', 'stuck'],
} as const;

export type StampHome = keyof typeof STAMP_TILES;
export const STAMP_HOMES = Object.keys(STAMP_TILES) as StampHome[];

/** The `kpi_snapshots.key` of one tile: `tile:lead:overdue`. */
export function stampKey(home: StampHome, tile: string): string {
  return `tile:${home}:${tile}`;
}

/** The tile values a home may store: known keys only, whole numbers from 0 to 100 000. */
export function cleanStampValues(home: StampHome, values: Record<string, unknown>): Record<string, number> {
  const allowed = new Set<string>(STAMP_TILES[home]);
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(values)) {
    if (!allowed.has(key)) continue;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 100_000) continue;
    out[key] = raw;
  }
  return out;
}

/** The India days before `todayYmd` a line may use, oldest first. */
export function stampDays(todayYmd: string, n = TREND_POINTS): string[] {
  const out: string[] = [];
  for (let i = n; i >= 1; i -= 1) out.push(addDaysYmd(todayYmd, -i));
  return out;
}

/** Stored rows (`period` YYYY-MM-DD, `key`, `value`) to trend series per tile, without today. */
export function stampSeries(
  home: StampHome,
  days: string[],
  rows: Array<{ period: string; key: string; value: number }>,
): HomeTrends {
  const byKey = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!Number.isFinite(r.value)) continue;
    const m = byKey.get(r.key) ?? new Map<string, number>();
    m.set(r.period, r.value);
    byKey.set(r.key, m);
  }
  const out: HomeTrends = {};
  for (const tile of STAMP_TILES[home]) {
    const m = byKey.get(stampKey(home, tile));
    if (!m) continue;
    const series = trailingKnown(days.map((d) => m.get(d) ?? null));
    if (series.length > 0) out[tile] = series;
  }
  return out;
}
