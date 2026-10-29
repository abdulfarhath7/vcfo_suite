/**
 * Work sessions on one item (task drawer timer, G-16). A session is running while
 * `endedAt` is null; each person has at most one running session at a time, which the
 * repository enforces by stopping the old one when a new one starts.
 */
export interface WorkSessionDto {
  id: string;
  itemKey: string;
  engagementId: string | null;
  userId: string;
  userName: string | null;
  startedAt: string;
  endedAt: string | null;
  note: string | null;
}

export interface ItemSessionsPayload {
  sessions: WorkSessionDto[];
  /** Everyone's time on the item, running sessions counted up to the read. */
  totalMs: number;
  /** The caller's running session on this item, if any. */
  running: WorkSessionDto | null;
}

/** Length of one session in milliseconds; a running session counts up to `nowMs`. */
export function sessionMs(session: Pick<WorkSessionDto, 'startedAt' | 'endedAt'>, nowMs: number): number {
  const start = Date.parse(session.startedAt);
  const end = session.endedAt ? Date.parse(session.endedAt) : nowMs;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

export function totalSessionMs(
  sessions: Array<Pick<WorkSessionDto, 'startedAt' | 'endedAt'>>,
  nowMs: number,
): number {
  return sessions.reduce((sum, s) => sum + sessionMs(s, nowMs), 0);
}

/** Running clock, for example `1:05:09`. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Quiet total, for example `45 min` or `2 h 5 min`. Under a minute reads `0 min`. */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
