/**
 * Audit log paging — the `before` cursor the Audit log page sends and
 * `GET /api/audit-logs` reads back. Pure; client- and server-safe.
 *
 * The repository pages by keyset (`created_at < before`). Events written in one
 * transaction share a timestamp (Postgres `now()` is the transaction time) and
 * the API returns milliseconds while the column keeps microseconds, so the next
 * cursor is the oldest loaded event plus one millisecond: the next page repeats
 * that last millisecond and the page drops the repeats by id (`mergeAuditPages`).
 */

/** `?before=` → a Date, or undefined when absent or not a date (the first page). */
export function parseAuditBefore(raw: string | null | undefined): Date | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t);
}

/** The cursor for the page after `events`: the oldest event plus 1 ms, as ISO. */
export function nextAuditBefore(events: ReadonlyArray<{ created_at: string }>): string | undefined {
  let oldest = Infinity;
  for (const e of events) {
    const t = Date.parse(e.created_at);
    if (!Number.isNaN(t) && t < oldest) oldest = t;
  }
  return Number.isFinite(oldest) ? new Date(oldest + 1).toISOString() : undefined;
}

/** Every page joined, each event once, newest first. */
export function mergeAuditPages<T extends { id: string; created_at: string }>(pages: ReadonlyArray<ReadonlyArray<T>>): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const page of pages) {
    for (const e of page) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  }
  return out.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}
