/**
 * Planner blocks — the pure rules both the repository and the console share.
 *
 * A block is a work session on one calendar day, between 9:00 am and 7:00 pm,
 * at least 15 minutes long (prototype mxTimeBox: "Pick a time between 9:00 am
 * and 7:00 pm", "End must be at least 15 minutes after start"). Times are
 * minutes after midnight in India time.
 */

export const PLANNER_DAY_START_MIN = 9 * 60;
export const PLANNER_DAY_END_MIN = 19 * 60;
export const PLANNER_MIN_BLOCK_MIN = 15;
export const PLANNER_TITLE_MAX = 200;
/** One "Add n blocks to calendar" press never writes more than this. */
export const PLANNER_BATCH_MAX = 40;

export interface PlannerBlockDto {
  id: string;
  /** `profiles.id` whose calendar holds the block. */
  ownerId: string;
  createdBy: string | null;
  /** App engagement id (legacy ids mapped back), or null. */
  engagementId: string | null;
  itemRef: string | null;
  title: string;
  /** YYYY-MM-DD */
  day: string;
  startMin: number;
  endMin: number;
  updatedAt: string;
}

export interface PlannerBlockInput {
  /** Defaults to the caller. */
  ownerId?: string;
  engagementId?: string | null;
  itemRef?: string | null;
  title: string;
  day: string;
  startMin: number;
  endMin: number;
}

export interface PlannerBlockPatch {
  day?: string;
  startMin?: number;
  endMin?: number;
  title?: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const REF_RE = /^(step|filing|request|task|todo):[A-Za-z0-9:._@-]{1,240}$/;

export function isPlannerDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === value;
}

export function isPlannerItemRef(value: unknown): value is string {
  return typeof value === 'string' && REF_RE.test(value);
}

/** null when the times are fine, else a short reason code. */
export function blockTimesError(startMin: unknown, endMin: unknown): 'times_invalid' | 'outside_day' | 'too_short' | null {
  if (typeof startMin !== 'number' || typeof endMin !== 'number' || !Number.isInteger(startMin) || !Number.isInteger(endMin)) {
    return 'times_invalid';
  }
  if (startMin < PLANNER_DAY_START_MIN || endMin > PLANNER_DAY_END_MIN) return 'outside_day';
  if (endMin - startMin < PLANNER_MIN_BLOCK_MIN) return 'too_short';
  return null;
}

export const PLANNER_ERROR_TEXT: Record<string, string> = {
  times_invalid: 'Use a start and end time.',
  outside_day: 'Pick a time between 9:00 am and 7:00 pm.',
  too_short: 'End must be at least 15 minutes after start.',
  day_invalid: 'Pick a day.',
  title_required: 'Give the block a name.',
  ref_invalid: 'That item cannot be planned.',
  too_many: 'Add fewer blocks at a time.',
  planner_not_ready: 'Calendar blocks are not switched on yet. Ask the admin to run the latest database update.',
  not_permitted: 'You can only plan your own calendar and your project leads’.',
  not_found: 'That block is gone. Refresh the calendar.',
};

/** Normalise and check one create input; throws a reason code. */
export function cleanBlockInput(raw: unknown): PlannerBlockInput {
  if (!raw || typeof raw !== 'object') throw new Error('times_invalid');
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, PLANNER_TITLE_MAX) : '';
  if (!title) throw new Error('title_required');
  if (!isPlannerDay(o.day)) throw new Error('day_invalid');
  const err = blockTimesError(o.startMin, o.endMin);
  if (err) throw new Error(err);
  const rawRef = o.itemRef === undefined || o.itemRef === null || o.itemRef === '' ? null : o.itemRef;
  if (rawRef !== null && !isPlannerItemRef(rawRef)) throw new Error('ref_invalid');
  const itemRef: string | null = rawRef === null ? null : String(rawRef);
  const ownerId = typeof o.ownerId === 'string' && o.ownerId.trim() ? o.ownerId.trim() : undefined;
  const engagementId = typeof o.engagementId === 'string' && o.engagementId.trim() ? o.engagementId.trim() : null;
  return { ownerId, engagementId, itemRef, title, day: o.day as string, startMin: o.startMin as number, endMin: o.endMin as number };
}

/** Normalise and check a patch merged over the stored block; throws a reason code. */
export function cleanBlockPatch(
  raw: unknown,
  current: { day: string; startMin: number; endMin: number; title: string },
): Required<PlannerBlockPatch> {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const day = o.day === undefined ? current.day : o.day;
  if (!isPlannerDay(day)) throw new Error('day_invalid');
  const startMin = o.startMin === undefined ? current.startMin : o.startMin;
  const endMin = o.endMin === undefined ? current.endMin : o.endMin;
  const err = blockTimesError(startMin, endMin);
  if (err) throw new Error(err);
  const title = o.title === undefined ? current.title : typeof o.title === 'string' ? o.title.trim().slice(0, PLANNER_TITLE_MAX) : '';
  if (!title) throw new Error('title_required');
  return { day, startMin: startMin as number, endMin: endMin as number, title };
}

/** Postgres "relation does not exist" — the migration has not run yet. */
export function isMissingTableError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur);
    const e = cur as { code?: unknown; message?: unknown; cause?: unknown };
    if (e.code === '42P01') return true;
    if (typeof e.message === 'string' && /relation "?[\w.]*planner_blocks"? does not exist/i.test(e.message)) return true;
    cur = e.cause;
  }
  return false;
}
