/**
 * Pure rules for the Analytics Workload hours (F-163): the India week and the hour sums.
 */

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 5.5 * 3_600_000;

/** The India week holding `now`: Monday 00:00 IST to the next Monday 00:00 IST. */
export function istWeekBounds(now: Date): { start: Date; end: Date; weekStart: string } {
  const local = new Date(now.getTime() + IST_OFFSET_MS);
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  const mondayUtcMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - dow * DAY_MS;
  const start = new Date(mondayUtcMidnight - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS), weekStart: new Date(mondayUtcMidnight).toISOString().slice(0, 10) };
}

/** Hours per user id, one decimal; a block is cut at `cap` (the week end). */
export function sumBlockHours(blocks: Array<{ userId: string; startsAt: Date; endsAt: Date }>, cap: Date): Map<string, number> {
  const ms = new Map<string, number>();
  for (const b of blocks) {
    const endMs = Math.min(b.endsAt.getTime(), cap.getTime());
    const span = endMs - b.startsAt.getTime();
    if (span <= 0) continue;
    ms.set(b.userId, (ms.get(b.userId) ?? 0) + span);
  }
  const out = new Map<string, number>();
  for (const [id, v] of ms) out.set(id, Math.round((v / 3_600_000) * 10) / 10);
  return out;
}
